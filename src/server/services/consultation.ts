import { createHmac } from 'node:crypto';
import type { Ctx } from '../lib/context.ts';
import { HttpError } from '../lib/context.ts';
import { safeEqual } from '../lib/crypto.ts';
import type { ScoreResult } from '../../shared/types.ts';
import { advanceStatus, type AssessmentRow } from './assessments.ts';
import { track } from './analytics.ts';
import { notify } from './notifications.ts';

/** Booking URL with prefill. Works with any scheduler that accepts query-string prefill (Cal.com, Calendly, …). */
export async function buildBookingUrl(ctx: Ctx, a: AssessmentRow): Promise<string> {
  const s = await ctx.db.one<{ overall_rounded: number; result: ScoreResult }>('SELECT overall_rounded, result FROM assessment_scores WHERE assessment_id=$1', [a.id]);
  const at = await ctx.db.one<Record<string, string | null>>('SELECT latest_source, latest_medium, latest_campaign, first_category FROM attribution WHERE assessment_id=$1', [a.id]);
  let url: URL;
  try { url = new URL(ctx.env.BOOKING_URL); } catch { throw new HttpError(503, 'Consultation booking is not configured.', 'booking_unavailable'); }
  const set = (k: string, v: string | number | null | undefined) => { if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v)); };
  set('name', a.respondent_name);
  set('email', a.email);
  set('phone', a.mobile);
  set('company', a.business_name);
  set('assessment_id', a.public_id);
  set('readiness_score', s?.overall_rounded);
  set('readiness_band', s?.result.band.label);
  set('opportunity_profile', s?.result.opportunity.label);
  set('utm_source', at?.latest_source);
  set('utm_medium', at?.latest_medium);
  set('utm_campaign', at?.latest_campaign);
  set('source_category', at?.first_category);
  return url.toString();
}

/** User clicked "Book Consultation". Idempotent; never downgrades a booked consultation. */
export async function recordClick(ctx: Ctx, a: AssessmentRow): Promise<string> {
  await ctx.db.tx(async (t) => {
    await t.query(
      `INSERT INTO consultations (assessment_id, status, clicked_at, source) VALUES ($1,'clicked', now(), 'user')
       ON CONFLICT (assessment_id) DO UPDATE SET clicked_at = COALESCE(consultations.clicked_at, now()), updated_at = now()`, [a.id]);
    await t.query(`UPDATE assessments SET consultation_status='clicked' WHERE id=$1 AND consultation_status='none'`, [a.id]);
  });
  await track(ctx, { event: 'consultation_clicked', assessmentId: a.id });
  return buildBookingUrl(ctx, a);
}

export interface BookingInput { reference?: string | null; bookedAt?: Date; source: 'webhook' | 'self_reported' | 'admin'; metadata?: Record<string, unknown> }

/** Marks the consultation booked. Safe to repeat: the first booking time and reference are kept. */
export async function recordBooked(ctx: Ctx, assessmentId: string, input: BookingInput): Promise<{ firstTime: boolean }> {
  const a = await ctx.db.one<AssessmentRow>('SELECT * FROM assessments WHERE id=$1', [assessmentId]);
  if (!a) throw new HttpError(404, 'Not found');
  const bookedAt = input.bookedAt ?? new Date();
  const firstTime = await ctx.db.tx(async (t) => {
    const prev = await t.one<{ status: string }>('SELECT status FROM consultations WHERE assessment_id=$1 FOR UPDATE', [assessmentId]);
    const was = prev?.status === 'booked';
    await t.query(
      `INSERT INTO consultations (assessment_id, status, booked_at, booking_reference, source, metadata) VALUES ($1,'booked',$2,$3,$4,$5)
       ON CONFLICT (assessment_id) DO UPDATE SET
         status='booked',
         booked_at = COALESCE(consultations.booked_at, EXCLUDED.booked_at),
         booking_reference = COALESCE(consultations.booking_reference, EXCLUDED.booking_reference),
         source = CASE WHEN consultations.status='booked' THEN consultations.source ELSE EXCLUDED.source END,
         metadata = COALESCE(consultations.metadata, EXCLUDED.metadata),
         updated_at = now()`,
      [assessmentId, bookedAt, input.reference ?? null, input.source, JSON.stringify(input.metadata ?? {})]);
    await t.query(`UPDATE assessments SET consultation_status='booked', consultation_booked_at = COALESCE(consultation_booked_at, $2) WHERE id=$1`, [assessmentId, bookedAt]);
    await advanceStatus(t, assessmentId, 'consultation_booked');
    return !was;
  });
  if (firstTime) {
    await track(ctx, { event: 'consultation_booked', assessmentId, props: { bookingSource: input.source } });
    await notify(ctx, { assessmentId, template: 'consultation_confirmation', email: a.email, vars: { name: a.respondent_name ?? '', link: '' } });
  }
  return { firstTime };
}

// ── Booking webhook ─────────────────────────────────────────────────

export const signWebhook = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('hex');

export function verifyWebhook(ctx: Ctx, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const given = signature.replace(/^sha256=/, '');
  return safeEqual(given, signWebhook(ctx.env.BOOKING_WEBHOOK_SECRET, rawBody));
}

/** Accepts a generic payload ({assessment_id, booking_reference, booked_at}) or a Cal.com-style BOOKING_CREATED event. */
export function parseBookingPayload(body: any): { publicId: string; reference?: string; bookedAt?: Date } | null {
  if (!body || typeof body !== 'object') return null;
  if (body.triggerEvent && body.triggerEvent !== 'BOOKING_CREATED') return null;
  const p = body.payload ?? body;
  const pid = p.assessment_id ?? p.assessmentId ?? p.metadata?.assessment_id ?? p.responses?.assessment_id?.value;
  if (typeof pid !== 'string') return null;
  const ref = p.booking_reference ?? p.bookingReference ?? p.uid ?? p.id;
  const when = p.booked_at ?? p.createdAt ?? p.startTime;
  const d = when ? new Date(when) : undefined;
  return { publicId: pid, reference: ref ? String(ref).slice(0, 120) : undefined, bookedAt: d && !Number.isNaN(d.getTime()) ? d : undefined };
}
