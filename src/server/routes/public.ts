import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../lib/context.ts';
import { HttpError } from '../lib/context.ts';
import { assessmentAuth, parse } from './common.ts';
import {
  completeAssessment, completePhase, createAssessment, getState, isLocked, requestResume, saveResponses, updateLatestTouch, viewedResult,
} from '../services/assessments.ts';
import { getResult } from '../services/result.ts';
import { getReportPdf } from '../services/reports.ts';
import { recordBooked, recordClick, parseBookingPayload, verifyWebhook } from '../services/consultation.ts';
import { retryAnalysis } from '../services/analysis.ts';
import { track } from '../services/analytics.ts';
import { categorise, deviceFromUA, parseTouch } from '../lib/attribution.ts';
import { enqueueJob } from '../jobs/queue.ts';

export interface RateLimits { create: number; resume: number; save: number; events: number }
export const DEFAULT_LIMITS: RateLimits = { create: 20, resume: 6, save: 400, events: 120 };

const touch = z.record(z.string(), z.unknown()).optional();
const answerValue = z.union([z.string().max(5000), z.number(), z.array(z.string().max(200)).max(30), z.null()]);

export function publicRoutes(app: FastifyInstance, ctx: Ctx, limits: RateLimits) {
  const auth = assessmentAuth(ctx);
  const hourly = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 hour' } } });
  const perMinute = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/public-config', async () => ({ supportEmail: ctx.env.SUPPORT_EMAIL || null }));

  // ── Funnel events from the public site (anonymous; allow-listed) ──
  app.post('/api/events', perMinute(limits.events), async (req, reply) => {
    const b = parse(z.object({
      event: z.enum(['landing_view', 'cta_clicked']), visitorId: z.string().max(64).optional(),
      touch, referrer: z.string().max(300).optional(), props: z.record(z.string(), z.unknown()).optional(),
    }), req.body);
    const t = parseTouch(b.touch ?? {});
    await track(ctx, { event: b.event, visitorId: b.visitorId, source: categorise(t, b.referrer), device: deviceFromUA(req.headers['user-agent']), props: b.props });
    return reply.code(204).send();
  });

  // ── Create / resume ──
  app.post('/api/assessments', hourly(limits.create), async (req, reply) => {
    const b = parse(z.object({
      visitorId: z.string().max(64).optional(), landingUrl: z.string().max(500).optional(), referrer: z.string().max(300).optional(),
      firstTouch: touch, latestTouch: touch, consent: z.literal(true, { error: 'Consent to the privacy notice is required.' }),
    }), req.body ?? {});
    const { consent: _consent, ...rest } = b;
    void _consent;
    const out = await createAssessment(ctx, { ...rest, userAgent: req.headers['user-agent'] });
    return reply.code(201).send({ id: out.publicId, token: out.token });
  });

  app.post('/api/resume', { config: { rateLimit: { max: limits.resume, timeWindow: '1 hour' } } }, async (req) => {
    const b = parse(z.object({ email: z.string().email().max(200), mobile: z.string().min(5).max(30) }), req.body);
    await requestResume(ctx, b.email, b.mobile);
    // Identical response whether or not a match exists.
    return { ok: true, message: 'If an assessment matches these details, a link to continue has been sent to the email address provided.' };
  });

  // ── Assessment (token-authorised) ──
  const scoped = { preHandler: auth };

  app.get<{ Params: { id: string } }>('/api/assessments/:id', scoped, async (req) => getState(ctx, req.assessment!));

  app.patch<{ Params: { id: string } }>('/api/assessments/:id', scoped, async (req) => {
    const b = parse(z.object({ currentPhase: z.number().int().min(1).max(7).optional(), latestTouch: touch, referrer: z.string().max(300).optional() }), req.body ?? {});
    const a = req.assessment!;
    if (b.latestTouch) await updateLatestTouch(ctx, a, b.latestTouch, b.referrer);
    if (b.currentPhase && !isLocked(a)) {
      await ctx.db.query('UPDATE assessments SET current_phase=$2, last_activity_at=now() WHERE id=$1', [a.id, b.currentPhase]);
    }
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/assessments/:id/responses', { ...scoped, ...perMinute(limits.save) }, async (req) => {
    const b = parse(z.object({ answers: z.record(z.string().max(12), answerValue), currentPhase: z.number().int().min(1).max(7).optional() }), req.body);
    if (Object.keys(b.answers).length > 60) throw new HttpError(400, 'Too many answers in one request.');
    return saveResponses(ctx, req.assessment!, b.answers, b.currentPhase);
  });

  app.post<{ Params: { id: string } }>('/api/assessments/:id/phase-complete', scoped, async (req) => {
    const b = parse(z.object({ phase: z.number().int().min(1).max(6) }), req.body);
    return completePhase(ctx, req.assessment!, b.phase);
  });

  app.post<{ Params: { id: string } }>('/api/assessments/:id/complete', scoped, async (req) => {
    const out = await completeAssessment(ctx, req.assessment!);
    return { ok: true, ...out };
  });

  /** User-triggered re-request of the interpretation when it has not completed. Idempotent. */
  app.post<{ Params: { id: string } }>('/api/assessments/:id/analyze', scoped, async (req) => {
    const a = req.assessment!;
    if (!isLocked(a)) throw new HttpError(409, 'The assessment has not been completed.', 'incomplete');
    if (a.analysis_status === 'failed') await retryAnalysis(ctx, a.id);
    else if (a.analysis_status === 'pending') await enqueueJob(ctx.db, 'analysis', a.id);
    return { ok: true, analysisStatus: a.analysis_status === 'failed' ? 'pending' : a.analysis_status };
  });

  app.get<{ Params: { id: string } }>('/api/assessments/:id/result', scoped, async (req, reply) => {
    const a = req.assessment!;
    if (!isLocked(a)) throw new HttpError(409, 'The assessment is not complete, so there is no result yet.', 'incomplete');
    void viewedResult(ctx, a);
    reply.header('Cache-Control', 'no-store');
    return getResult(ctx, a);
  });

  app.get<{ Params: { id: string } }>('/api/assessments/:id/report', scoped, async (req, reply) => {
    const a = req.assessment!;
    if (!isLocked(a)) throw new HttpError(409, 'The assessment is not complete.', 'incomplete');
    const pdf = await getReportPdf(ctx, a.id);
    if (!pdf) throw new HttpError(409, 'Your assessment is complete. Your report is being prepared.', 'report_pending');
    await track(ctx, { event: 'report_viewed', assessmentId: a.id });
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="AI-Readiness-Diagnostic-${a.public_id.slice(0, 8)}.pdf"`)
      .header('Cache-Control', 'no-store')
      .send(pdf);
  });

  app.post<{ Params: { id: string } }>('/api/assessments/:id/consultation', scoped, async (req) => {
    const a = req.assessment!;
    if (!isLocked(a)) throw new HttpError(409, 'Complete the assessment before booking a consultation.', 'incomplete');
    // "Booked" is only ever set by the booking provider's webhook or by an admin — never self-reported by the browser.
    const bookingUrl = await recordClick(ctx, a);
    return { bookingUrl, consultationStatus: a.consultation_status === 'booked' ? 'booked' : 'clicked' };
  });

  // ── Booking confirmation webhook (HMAC-signed) ──
  app.post('/api/webhooks/booking', async (req, reply) => {
    const sig = (req.headers['x-signature'] ?? req.headers['x-cal-signature-256']) as string | undefined;
    if (!req.rawBody || !verifyWebhook(ctx, req.rawBody, sig)) throw new HttpError(401, 'Invalid signature.', 'bad_signature');
    const p = parseBookingPayload(req.body);
    if (!p) return reply.code(202).send({ ok: true, ignored: true });
    const row = await ctx.db.one<{ id: string }>('SELECT id FROM assessments WHERE public_id=$1', [p.publicId]);
    if (!row) return reply.code(202).send({ ok: true, ignored: true });
    await recordBooked(ctx, row.id, { source: 'webhook', reference: p.reference, bookedAt: p.bookedAt });
    return { ok: true };
  });
}
