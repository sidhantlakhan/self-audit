import type { Answer, Answers, AssessmentConfig } from '../../shared/types.ts';
import { getConfig, questionIndex, questionsForPhase, CURRENT_ASSESSMENT_VERSION } from '../../shared/config/index.ts';
import { completionPercentage, normalizeEmail, normalizePhone, validatePatch, validateQuestions } from '../../shared/validation.ts';
import type { Ctx } from '../lib/context.ts';
import { HttpError } from '../lib/context.ts';
import { hmac, publicId, randomToken } from '../lib/crypto.ts';
import { categorise, deviceFromUA, hasTouch, parseTouch, type Touch } from '../lib/attribution.ts';
import { track } from './analytics.ts';
import { notify } from './notifications.ts';
import { scoreAssessment } from '../scoring/engine.ts';
import { enqueueJob } from '../jobs/queue.ts';
import { PROMPT_VERSION } from '../ai/prompts.ts';
import type { Db } from '../db/client.ts';

export const STATUS_ORDER = ['started', 'in_progress', 'completed', 'analysis_pending', 'analysis_complete', 'report_pending', 'report_complete', 'consultation_booked'] as const;
export type Status = (typeof STATUS_ORDER)[number];
const TOKEN_TTL_DAYS = 90;
export const REVIEW_PHASE = 7; // current_phase value meaning "on the review screen"

export interface AssessmentRow {
  id: string; public_id: string; status: Status; analysis_status: string; report_status: string; consultation_status: string;
  respondent_name: string | null; business_name: string | null; mobile: string | null; email: string | null;
  role: string | null; industry: string | null; business_model: string[] | null; turnover_range: string | null;
  team_size: string | null; years_in_operation: string | null;
  current_phase: number; completed_phases: number[]; completion_percentage: number;
  assessment_version: string; scoring_version: string | null; prompt_version: string | null; report_version: string | null;
  created_at: Date; started_at: Date | null; last_activity_at: Date; completed_at: Date | null;
  analysis_completed_at: Date | null; report_generated_at: Date | null; consultation_booked_at: Date | null;
}

const FIELD_COLUMNS: Record<string, string> = {
  respondent_name: 'respondent_name', business_name: 'business_name', mobile: 'mobile', email: 'email', role: 'role', industry: 'industry',
  business_model: 'business_model', turnover_range: 'turnover_range', team_size: 'team_size', years_in_operation: 'years_in_operation',
};

// ── Status ────────────────────────────────────────────────────────────

/** Only ever moves the lifecycle status forward (late job completions cannot undo a booking). */
export async function advanceStatus(db: Db, id: string, to: Status): Promise<void> {
  const order = `ARRAY[${STATUS_ORDER.map((s) => `'${s}'`).join(',')}]::text[]`;
  await db.query(`UPDATE assessments SET status=$2 WHERE id=$1 AND array_position(${order}, status) < array_position(${order}, $2::text)`, [id, to]);
}

// ── Tokens ────────────────────────────────────────────────────────────

const tokenHash = (ctx: Ctx, token: string) => hmac(ctx.env.RESUME_TOKEN_SECRET, token);

export async function issueToken(ctx: Ctx, assessmentId: string): Promise<string> {
  const token = randomToken(32);
  await ctx.db.query(
    `INSERT INTO assessment_tokens (assessment_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)`,
    [assessmentId, tokenHash(ctx, token), String(TOKEN_TTL_DAYS)]);
  return token;
}

/** Returns the assessment only if `token` is valid for exactly this public id. Same null for "no such id" and "bad token". */
export async function authenticate(ctx: Ctx, pid: string, token: string | undefined): Promise<AssessmentRow | null> {
  if (!token || token.length < 20 || token.length > 100 || pid.length > 40) return null;
  const row = await ctx.db.one<AssessmentRow & { token_id: string }>(
    `SELECT a.*, t.id AS token_id FROM assessment_tokens t JOIN assessments a ON a.id = t.assessment_id
     WHERE t.token_hash = $1 AND t.expires_at > now() AND a.public_id = $2`, [tokenHash(ctx, token), pid]);
  if (!row) return null;
  await ctx.db.query(`UPDATE assessment_tokens SET last_used_at = now() WHERE id=$1 AND (last_used_at IS NULL OR last_used_at < now() - interval '1 hour')`, [row.token_id]);
  return row;
}

export const resumeLink = (ctx: Ctx, pid: string, token: string, path = '') => `${ctx.env.APP_URL.replace(/\/$/, '')}/a/${pid}${path}#t=${token}`;

// ── Create ────────────────────────────────────────────────────────────

export const CONSENT_VERSION = 'privacy-v1';

export interface CreateInput {
  visitorId?: string;
  landingUrl?: string;
  referrer?: string;
  firstTouch?: Record<string, unknown>;
  latestTouch?: Record<string, unknown>;
  userAgent?: string;
}

export async function createAssessment(ctx: Ctx, input: CreateInput): Promise<{ publicId: string; token: string }> {
  const pid = publicId();
  const first = parseTouch(input.firstTouch ?? {});
  const latest = hasTouch(parseTouch(input.latestTouch ?? {})) ? parseTouch(input.latestTouch ?? {}) : first;
  const referrer = input.referrer?.slice(0, 300);
  const device = deviceFromUA(input.userAgent);
  const now = new Date();
  const row = await ctx.db.tx(async (t) => {
    const a = await t.one<{ id: string }>(`INSERT INTO assessments (public_id, assessment_version, consent_at, consent_version) VALUES ($1,$2, now(), $3) RETURNING id`, [pid, CURRENT_ASSESSMENT_VERSION, CONSENT_VERSION]);
    await t.query(
      `INSERT INTO attribution (assessment_id, visitor_id, first_source, first_medium, first_campaign, first_content, first_term, first_ref, first_category, first_touch_at,
         latest_source, latest_medium, latest_campaign, latest_content, latest_term, latest_ref, latest_category, latest_touch_at, landing_url, referrer, device)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [a!.id, input.visitorId?.slice(0, 64) ?? null, first.source, first.medium, first.campaign, first.content, first.term, first.ref, categorise(first, referrer), now,
        latest.source, latest.medium, latest.campaign, latest.content, latest.term, latest.ref, categorise(latest, referrer), now,
        input.landingUrl?.slice(0, 500) ?? null, referrer ?? null, device].map((v) => v ?? null));
    return a!;
  });
  const token = await issueToken(ctx, row.id);
  await track(ctx, { event: 'assessment_started', assessmentId: row.id });
  await track(ctx, { event: 'phase_started', assessmentId: row.id, props: { phase: 1 } });
  return { publicId: pid, token };
}

/** Records a newer touch (e.g. returning via a different campaign link). First touch is never overwritten. */
export async function updateLatestTouch(ctx: Ctx, a: AssessmentRow, raw: Record<string, unknown>, referrer?: string): Promise<void> {
  const t: Touch = parseTouch(raw);
  if (!hasTouch(t)) return;
  await ctx.db.query(
    `UPDATE attribution SET latest_source=$2, latest_medium=$3, latest_campaign=$4, latest_content=$5, latest_term=$6, latest_ref=$7, latest_category=$8, latest_touch_at=now() WHERE assessment_id=$1`,
    [a.id, t.source ?? null, t.medium ?? null, t.campaign ?? null, t.content ?? null, t.term ?? null, t.ref ?? null, categorise(t, referrer)]);
}

// ── Read ──────────────────────────────────────────────────────────────

export async function getAnswers(db: Db, id: string): Promise<Answers> {
  const rows = await db.query<{ question_id: string; response_value: Answer }>('SELECT question_id, response_value FROM assessment_responses WHERE assessment_id=$1', [id]);
  return Object.fromEntries(rows.map((r) => [r.question_id, r.response_value]));
}

/** After completion the frozen snapshot is the source of truth. */
export async function getSnapshotAnswers(db: Db, id: string): Promise<Answers | null> {
  const s = await db.one<{ answers: Answers }>('SELECT answers FROM assessment_snapshots WHERE assessment_id=$1', [id]);
  return s?.answers ?? null;
}

export const isLocked = (a: AssessmentRow) => STATUS_ORDER.indexOf(a.status) >= STATUS_ORDER.indexOf('completed');

export async function getState(ctx: Ctx, a: AssessmentRow) {
  const cfg = getConfig(a.assessment_version);
  const answers = (await getSnapshotAnswers(ctx.db, a.id)) ?? (await getAnswers(ctx.db, a.id));
  return {
    id: a.public_id,
    status: a.status,
    locked: isLocked(a),
    currentPhase: a.current_phase,
    completedPhases: a.completed_phases,
    completionPercentage: a.completion_percentage,
    analysisStatus: a.analysis_status,
    reportStatus: a.report_status,
    consultationStatus: a.consultation_status,
    answers,
    config: publicConfig(cfg),
    updatedAt: a.last_activity_at,
  };
}

/** Client-facing configuration — scoring rules, weights and AI flags are deliberately not exposed. */
export function publicConfig(cfg: AssessmentConfig) {
  return {
    version: cfg.version,
    phases: cfg.phases.map((p) => ({ number: p.number, title: p.title, intro: p.intro })),
    questions: cfg.questions.map((q) => ({
      id: q.id, phase: q.phase, type: q.type, label: q.label, description: q.description, helpText: q.helpText, required: q.required,
      options: q.options?.map((o) => o.value), exclusiveOptions: q.exclusiveOptions, rankCount: q.rankCount, scale: q.scale,
      validation: q.validation, voice: q.voice, displayIf: q.displayIf,
    })),
  };
}

// ── Autosave ──────────────────────────────────────────────────────────

export async function saveResponses(ctx: Ctx, a: AssessmentRow, patch: Record<string, Answer>, currentPhase?: number) {
  const cfg = getConfig(a.assessment_version);
  const { ok, errors } = validatePatch(cfg, patch);
  if (Object.keys(errors).length) throw new HttpError(422, 'Some answers are invalid.', 'validation', errors);
  const idx = questionIndex(cfg);

  const result = await ctx.db.tx(async (t) => {
    const cur = await t.one<AssessmentRow>('SELECT * FROM assessments WHERE id=$1 FOR UPDATE', [a.id]);
    if (!cur) throw new HttpError(404, 'Not found');
    if (isLocked(cur)) throw new HttpError(409, 'This assessment has been completed and can no longer be changed.', 'locked');

    const sets: string[] = [];
    const vals: unknown[] = [a.id];
    for (const [qid, value] of Object.entries(ok)) {
      const q = idx.get(qid)!;
      if (value === null) {
        await t.query('DELETE FROM assessment_responses WHERE assessment_id=$1 AND question_id=$2', [a.id, qid]);
      } else {
        await t.query(
          `INSERT INTO assessment_responses (assessment_id, question_id, response_value, response_type) VALUES ($1,$2,$3,$4)
           ON CONFLICT (assessment_id, question_id) DO UPDATE SET response_value = EXCLUDED.response_value, updated_at = now()`,
          [a.id, qid, JSON.stringify(value), q.type]);
      }
      // Denormalise Phase 1 identity/context fields for search and admin listing.
      if (q.field) {
        let col: unknown = value;
        if (q.field === 'mobile' && typeof value === 'string') col = normalizePhone(value);
        if (q.field === 'email' && typeof value === 'string') col = normalizeEmail(value);
        if (q.field === 'business_model' && value !== null) col = JSON.stringify(value);
        vals.push(col);
        sets.push(`${FIELD_COLUMNS[q.field]} = $${vals.length}`);
      }
    }
    const all = await getAnswers(t, a.id);
    const pct = completionPercentage(cfg, all);
    vals.push(pct);
    sets.push(`completion_percentage = $${vals.length}`);
    if (currentPhase && currentPhase >= 1 && currentPhase <= REVIEW_PHASE) {
      vals.push(currentPhase);
      sets.push(`current_phase = $${vals.length}`);
    }
    if (cur.status === 'started') sets.push(`status = 'in_progress'`, `started_at = COALESCE(started_at, now())`);
    sets.push('last_activity_at = now()');
    await t.query(`UPDATE assessments SET ${sets.join(', ')} WHERE id=$1`, vals);
    return { pct };
  });

  for (const qid of Object.keys(ok)) await track(ctx, { event: 'question_answered', assessmentId: a.id, props: { questionId: qid, phase: idx.get(qid)!.phase } });
  return { savedAt: new Date().toISOString(), completionPercentage: result.pct };
}

// ── Phase completion ─────────────────────────────────────────────────

export async function completePhase(ctx: Ctx, a: AssessmentRow, phase: number) {
  const cfg = getConfig(a.assessment_version);
  if (!cfg.phases.some((p) => p.number === phase)) throw new HttpError(422, 'Unknown phase.', 'validation');
  const answers = await getAnswers(ctx.db, a.id);
  const errors = validateQuestions(questionsForPhase(cfg, phase), answers);
  if (Object.keys(errors).length) throw new HttpError(422, 'Please complete the required questions in this phase.', 'validation', errors);

  const next = phase >= cfg.phases.length ? REVIEW_PHASE : phase + 1;
  const firstTime = await ctx.db.tx(async (t) => {
    const cur = await t.one<AssessmentRow>('SELECT * FROM assessments WHERE id=$1 FOR UPDATE', [a.id]);
    if (!cur) throw new HttpError(404, 'Not found');
    if (isLocked(cur)) throw new HttpError(409, 'This assessment has been completed.', 'locked');
    const done = new Set<number>(cur.completed_phases);
    const first = !done.has(phase);
    done.add(phase);
    await t.query(
      `UPDATE assessments SET completed_phases=$2, current_phase=GREATEST(current_phase, $3), last_activity_at=now() WHERE id=$1`,
      [a.id, JSON.stringify([...done].sort((x, y) => x - y)), next]);
    return first;
  });
  if (firstTime) {
    await track(ctx, { event: 'phase_completed', assessmentId: a.id, props: { phase } });
    if (next <= cfg.phases.length) await track(ctx, { event: 'phase_started', assessmentId: a.id, props: { phase: next } });
    if (phase === 1) {
      const row = await ctx.db.one<AssessmentRow>('SELECT * FROM assessments WHERE id=$1', [a.id]);
      if (row?.email) {
        const token = await issueToken(ctx, a.id);
        await notify(ctx, { assessmentId: a.id, template: 'assessment_started', email: row.email, vars: { name: row.respondent_name ?? '', link: resumeLink(ctx, a.public_id, token) } });
      }
    }
  }
  return { phase, nextPhase: next };
}

// ── Final submission ─────────────────────────────────────────────────

/**
 * Validates, freezes the response snapshot, runs the deterministic scoring engine and queues AI analysis.
 * Idempotent: a second call on a completed assessment returns the existing result without side effects.
 */
export async function completeAssessment(ctx: Ctx, a: AssessmentRow): Promise<{ alreadyCompleted: boolean }> {
  const cfg = getConfig(a.assessment_version);
  let created = false;
  await ctx.db.tx(async (t) => {
    const cur = await t.one<AssessmentRow>('SELECT * FROM assessments WHERE id=$1 FOR UPDATE', [a.id]);
    if (!cur) throw new HttpError(404, 'Not found');
    if (isLocked(cur)) return;
    const answers = await getAnswers(t, a.id);
    const errors = validateQuestions(cfg.questions, answers);
    if (Object.keys(errors).length) throw new HttpError(422, 'The assessment is incomplete. Please answer the required questions before submitting.', 'incomplete', errors);

    await t.query('INSERT INTO assessment_snapshots (assessment_id, answers, assessment_version) VALUES ($1,$2,$3)', [a.id, JSON.stringify(answers), cfg.version]);
    const score = scoreAssessment(cfg, answers);
    await t.query(
      `INSERT INTO assessment_scores (assessment_id, overall_score, overall_rounded, readiness_band, scoring_version, assessment_version, result) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.id, score.overall, score.overallRounded, score.band.id, score.scoringVersion, score.assessmentVersion, JSON.stringify(score)]);
    for (const d of score.dimensions) {
      await t.query('INSERT INTO assessment_dimension_scores (assessment_id, dimension, score, weight) VALUES ($1,$2,$3,$4)', [a.id, d.dimension, d.score, d.weight]);
    }
    const ind: [string, string | null, unknown][] = [
      ['founder_dependency', score.founderDependency.level, score.founderDependency],
      ['opportunity', score.opportunity.level, score.opportunity],
      ['adoption_intent', score.adoptionIntent.rating ? String(score.adoptionIntent.rating) : null, score.adoptionIntent],
    ];
    for (const [kind, level, value] of ind) {
      await t.query('INSERT INTO assessment_indicators (assessment_id, kind, level, value) VALUES ($1,$2,$3,$4)', [a.id, kind, level, JSON.stringify(value)]);
    }
    await t.query(
      `INSERT INTO ai_analysis (assessment_id, status, prompt_version) VALUES ($1,'pending',$2) ON CONFLICT (assessment_id) DO NOTHING`, [a.id, PROMPT_VERSION]);
    await t.query(
      `UPDATE assessments SET status='analysis_pending', analysis_status='pending', completed_at=now(), last_activity_at=now(), completion_percentage=100, current_phase=$2,
         completed_phases=$3, scoring_version=$4, prompt_version=$5 WHERE id=$1`,
      [a.id, REVIEW_PHASE, JSON.stringify(cfg.phases.map((p) => p.number)), score.scoringVersion, PROMPT_VERSION]);
    await enqueueJob(t, 'analysis', a.id);
    created = true;
  });
  if (!created) return { alreadyCompleted: true };

  await track(ctx, { event: 'assessment_completed', assessmentId: a.id });
  const row = await ctx.db.one<AssessmentRow & { overall_rounded: number; readiness_band: string }>(
    `SELECT a.*, s.overall_rounded, s.result->'band'->>'label' AS readiness_band FROM assessments a JOIN assessment_scores s ON s.assessment_id=a.id WHERE a.id=$1`, [a.id]);
  if (row?.email) {
    const token = await issueToken(ctx, a.id);
    await notify(ctx, { assessmentId: a.id, template: 'assessment_completed', email: row.email, mobile: row.mobile,
      vars: { name: row.respondent_name ?? '', business: row.business_name ?? undefined, score: row.overall_rounded, band: row.readiness_band, link: resumeLink(ctx, a.public_id, token, '/result') } });
  }
  return { alreadyCompleted: false };
}

// ── Resume by email + mobile ─────────────────────────────────────────

/** Always resolves quietly: callers must not be able to learn whether an assessment exists. */
export async function requestResume(ctx: Ctx, emailRaw: string, mobileRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const mobile = normalizePhone(mobileRaw);
  if (!mobile) return;
  const rows = await ctx.db.query<AssessmentRow>(
    `SELECT * FROM assessments WHERE email=$1 AND mobile=$2 ORDER BY (completed_at IS NULL) DESC, last_activity_at DESC LIMIT 1`, [email, mobile]);
  const a = rows[0];
  if (!a) return;
  const token = await issueToken(ctx, a.id);
  const path = isLocked(a) ? '/result' : '';
  await notify(ctx, { assessmentId: a.id, template: 'assessment_resume', email: a.email, vars: { name: a.respondent_name ?? '', link: resumeLink(ctx, a.public_id, token, path) } });
}

export async function viewedResult(ctx: Ctx, a: AssessmentRow) {
  await track(ctx, { event: 'result_viewed', assessmentId: a.id });
}
