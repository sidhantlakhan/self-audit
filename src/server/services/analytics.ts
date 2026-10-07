import type { Ctx } from '../lib/context.ts';

export const EVENT_NAMES = [
  'landing_view', 'cta_clicked', 'assessment_started', 'phase_started', 'question_answered', 'phase_completed',
  'assessment_completed', 'analysis_started', 'analysis_completed', 'result_viewed', 'report_generated',
  'report_viewed', 'consultation_clicked', 'consultation_booked',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Property keys that may be stored. Anything else (names, emails, answers) is dropped. */
const ALLOWED_PROPS = new Set(['phase', 'questionId', 'location', 'status', 'band', 'score', 'path', 'bookingSource', 'attempt']);

function sanitiseProps(props: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (!ALLOWED_PROPS.has(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 80);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export interface TrackInput {
  event: EventName;
  assessmentId?: string | null; // internal uuid
  visitorId?: string | null;
  source?: string | null;
  device?: string | null;
  props?: Record<string, unknown>;
}

/** Analytics sink. `ANALYTICS_PROVIDER=none` disables it; add forwarders (GA, PostHog, …) here. */
export async function track(ctx: Pick<Ctx, 'env' | 'db' | 'log'>, e: TrackInput): Promise<void> {
  if (ctx.env.ANALYTICS_PROVIDER === 'none') return;
  try {
    let { source, device, visitorId } = e;
    if (e.assessmentId && (!source || !device || !visitorId)) {
      const a = await ctx.db.one<{ first_category: string; device: string; visitor_id: string }>(
        'SELECT first_category, device, visitor_id FROM attribution WHERE assessment_id = $1', [e.assessmentId]);
      source ??= a?.first_category; device ??= a?.device; visitorId ??= a?.visitor_id;
    }
    await ctx.db.query(
      'INSERT INTO analytics_events (event, assessment_id, visitor_id, source, device, props) VALUES ($1,$2,$3,$4,$5,$6)',
      [e.event, e.assessmentId ?? null, visitorId ?? null, source ?? null, device ?? null, JSON.stringify(sanitiseProps(e.props))],
    );
  } catch (err) {
    ctx.log.warn({ err: (err as Error).message, event: e.event }, 'analytics write failed');
  }
}
