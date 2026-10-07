import type { Ctx } from '../lib/context.ts';
import { HttpError } from '../lib/context.ts';
import { hashPassword, hmac, randomToken, verifyPassword } from '../lib/crypto.ts';
import { getConfig } from '../../shared/config/index.ts';
import type { ScoreResult } from '../../shared/types.ts';
import type { AssessmentRow } from './assessments.ts';
import { getAnswers, getSnapshotAnswers } from './assessments.ts';

const SESSION_HOURS = 8;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export interface AdminSession { adminId: string; email: string; name: string | null; csrf: string; sessionId: string }

// ── Audit ────────────────────────────────────────────────────────────

export async function audit(ctx: Ctx, who: { adminId?: string | null; email?: string | null }, action: string, entity?: string, entityId?: string, metadata: Record<string, unknown> = {}, ip?: string): Promise<void> {
  await ctx.db.query(
    'INSERT INTO audit_logs (admin_id, admin_email, action, entity, entity_id, metadata, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [who.adminId ?? null, who.email ?? null, action, entity ?? null, entityId ?? null, JSON.stringify(metadata), ip ?? null]);
}

// ── Authentication ───────────────────────────────────────────────────

// A real scrypt hash of a random value: used so unknown-email attempts cost the same as real ones.
let dummyHash: Promise<string> | null = null;
const getDummy = () => (dummyHash ??= hashPassword(randomToken(16)));

async function lockedUntil(ctx: Ctx, keys: string[]): Promise<Date | null> {
  const rows = await ctx.db.query<{ locked_until: Date | null }>(`SELECT locked_until FROM login_attempts WHERE key = ANY($1::text[]) AND locked_until > now()`, [keys]);
  return rows.length ? rows.map((r) => r.locked_until!).sort((a, b) => b.getTime() - a.getTime())[0] : null;
}

async function recordFailure(ctx: Ctx, key: string, limit: number): Promise<void> {
  await ctx.db.query(
    `INSERT INTO login_attempts (key, failures, locked_until) VALUES ($1, 1, NULL)
     ON CONFLICT (key) DO UPDATE SET
       failures = CASE WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until <= now() THEN 1 ELSE login_attempts.failures + 1 END,
       locked_until = CASE WHEN (CASE WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until <= now() THEN 1 ELSE login_attempts.failures + 1 END) >= $2
                           THEN now() + ($3 || ' minutes')::interval ELSE NULL END,
       updated_at = now()`, [key, limit, String(LOCK_MINUTES)]);
}

export async function login(ctx: Ctx, emailRaw: string, password: string, ip: string, userAgent: string): Promise<{ token: string; session: AdminSession }> {
  const email = emailRaw.trim().toLowerCase();
  const keys = [`email:${email}`, `ip:${ip}`];
  const lock = await lockedUntil(ctx, keys);
  if (lock) {
    await audit(ctx, { email }, 'admin.login_blocked', 'admin_user', undefined, {}, ip);
    throw new HttpError(429, 'Too many failed attempts. Try again later.', 'locked');
  }
  const user = await ctx.db.one<{ id: string; email: string; name: string | null; password_hash: string; active: boolean }>('SELECT id, email, name, password_hash, active FROM admin_users WHERE email=$1', [email]);
  const ok = await verifyPassword(password, user?.password_hash ?? (await getDummy()));
  if (!user || !user.active || !ok) {
    await recordFailure(ctx, keys[0], MAX_FAILURES);
    await recordFailure(ctx, keys[1], MAX_FAILURES * 4);
    await audit(ctx, { email }, 'admin.login_failed', 'admin_user', undefined, {}, ip);
    ctx.log.warn({ ip }, 'admin login failed');
    throw new HttpError(401, 'Incorrect email or password.', 'invalid_credentials');
  }
  await ctx.db.query('DELETE FROM login_attempts WHERE key = ANY($1::text[])', [keys]);
  const token = randomToken(32);
  const csrf = randomToken(24);
  const row = await ctx.db.one<{ id: string }>(
    `INSERT INTO admin_sessions (admin_id, token_hash, csrf_token, ip, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' hours')::interval) RETURNING id`,
    [user.id, hmac(ctx.env.ADMIN_AUTH_SECRET, token), csrf, ip, userAgent.slice(0, 200), String(SESSION_HOURS)]);
  await ctx.db.query('UPDATE admin_users SET last_login_at=now() WHERE id=$1', [user.id]);
  await audit(ctx, { adminId: user.id, email }, 'admin.login', 'admin_user', user.id, {}, ip);
  return { token, session: { adminId: user.id, email: user.email, name: user.name, csrf, sessionId: row!.id } };
}

export async function getSession(ctx: Ctx, token: string | undefined): Promise<AdminSession | null> {
  if (!token || token.length > 100) return null;
  const r = await ctx.db.one<{ id: string; admin_id: string; csrf_token: string; email: string; name: string | null }>(
    `SELECT s.id, s.admin_id, s.csrf_token, u.email, u.name FROM admin_sessions s JOIN admin_users u ON u.id = s.admin_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active`, [hmac(ctx.env.ADMIN_AUTH_SECRET, token)]);
  return r ? { adminId: r.admin_id, email: r.email, name: r.name, csrf: r.csrf_token, sessionId: r.id } : null;
}

export async function logout(ctx: Ctx, s: AdminSession, ip: string): Promise<void> {
  await ctx.db.query('UPDATE admin_sessions SET revoked_at=now() WHERE id=$1', [s.sessionId]);
  await audit(ctx, s, 'admin.logout', 'admin_user', s.adminId, {}, ip);
}

export async function createAdmin(ctx: Ctx, email: string, password: string, name?: string): Promise<void> {
  if (password.length < 12) throw new Error('Admin password must be at least 12 characters');
  await ctx.db.query(
    `INSERT INTO admin_users (email, name, password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, active=true`,
    [email.trim().toLowerCase(), name ?? null, await hashPassword(password)]);
}

// ── Filters ──────────────────────────────────────────────────────────

export interface RangeQuery { from?: string; to?: string }

function range(q: RangeQuery, col: string, params: unknown[]): string[] {
  const w: string[] = [];
  if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) { params.push(q.from); w.push(`${col} >= $${params.length}::date`); }
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) { params.push(q.to); w.push(`${col} < ($${params.length}::date + interval '1 day')`); }
  return w;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

// ── Dashboard ────────────────────────────────────────────────────────

export async function dashboard(ctx: Ctx, q: RangeQuery) {
  const p: unknown[] = [];
  const where = ['1=1', ...range(q, 'a.created_at', p)].join(' AND ');

  const core = await ctx.db.one<Record<string, number>>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE a.started_at IS NOT NULL)::int AS started,
            count(*) FILTER (WHERE a.completed_at IS NOT NULL)::int AS completed,
            count(*) FILTER (WHERE a.consultation_status IN ('clicked','booked'))::int AS clicked,
            count(*) FILTER (WHERE a.consultation_status = 'booked')::int AS booked,
            count(*) FILTER (WHERE a.analysis_status = 'failed')::int AS analysis_failed,
            count(*) FILTER (WHERE a.report_status = 'failed')::int AS report_failed,
            COALESCE(avg(s.overall_rounded), 0)::float AS avg_score
     FROM assessments a LEFT JOIN assessment_scores s ON s.assessment_id = a.id WHERE ${where}`, p);
  const c = core!;

  const pv: unknown[] = [];
  const views = await ctx.db.one<{ visitors: number }>(
    `SELECT count(DISTINCT visitor_id)::int AS visitors FROM analytics_events WHERE event='landing_view' AND ${['1=1', ...range(q, 'created_at', pv)].join(' AND ')}`, pv);

  const sources = await ctx.db.query<any>(
    `SELECT COALESCE(t.first_category,'direct') AS source, count(*)::int AS assessments,
            count(*) FILTER (WHERE a.started_at IS NOT NULL)::int AS started,
            count(*) FILTER (WHERE a.completed_at IS NOT NULL)::int AS completed,
            count(*) FILTER (WHERE a.consultation_status='booked')::int AS booked
     FROM assessments a LEFT JOIN attribution t ON t.assessment_id=a.id WHERE ${where} GROUP BY 1 ORDER BY 2 DESC`, p);
  const campaigns = await ctx.db.query<any>(
    `SELECT COALESCE(t.first_campaign,'(none)') AS campaign, COALESCE(t.first_source,'(none)') AS source, count(*)::int AS assessments,
            count(*) FILTER (WHERE a.completed_at IS NOT NULL)::int AS completed,
            count(*) FILTER (WHERE a.consultation_status='booked')::int AS booked
     FROM assessments a JOIN attribution t ON t.assessment_id=a.id WHERE t.first_campaign IS NOT NULL AND ${where} GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25`, p);

  const opp = await ctx.db.query<{ level: string; n: number }>(
    `SELECT i.level, count(*)::int AS n FROM assessment_indicators i JOIN assessments a ON a.id=i.assessment_id WHERE i.kind='opportunity' AND ${where} GROUP BY 1`, p);
  const areas = await ctx.db.query<{ area: string; n: number }>(
    `SELECT e->>'label' AS area, count(*)::int AS n FROM assessment_indicators i JOIN assessments a ON a.id=i.assessment_id,
       jsonb_array_elements(i.value->'areas') e WHERE i.kind='opportunity' AND ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, p);
  const bands = await ctx.db.query<{ band: string; n: number }>(
    `SELECT s.readiness_band AS band, count(*)::int AS n FROM assessment_scores s JOIN assessments a ON a.id=s.assessment_id WHERE ${where} GROUP BY 1`, p);

  const withRates = <T extends { assessments: number; completed: number; booked: number }>(r: T) => ({
    ...r, completionRate: pct(r.completed, r.assessments), conversion: pct(r.booked, r.completed),
  });

  return {
    metrics: {
      totalAssessments: c.total, started: c.started, completed: c.completed,
      completionRate: pct(c.completed, c.started), averageScore: Math.round(c.avg_score * 10) / 10,
      consultationClicks: c.clicked, consultationBookings: c.booked,
      consultationConversion: pct(c.booked, c.completed), // primary KPI: booked ÷ completed
      analysisFailed: c.analysis_failed, reportFailed: c.report_failed,
    },
    funnel: [
      { step: 'Landing visitors', value: views?.visitors ?? 0 },
      { step: 'Assessments created', value: c.total },
      { step: 'Started answering', value: c.started },
      { step: 'Completed', value: c.completed },
      { step: 'Clicked Book Consultation', value: c.clicked },
      { step: 'Consultation booked', value: c.booked },
    ],
    sources: sources.map((r) => withRates({ ...r })),
    campaigns: campaigns.map((r) => withRates({ ...r })),
    opportunity: {
      levels: ['high', 'moderate', 'limited'].map((l) => ({ level: l, count: opp.find((o) => o.level === l)?.n ?? 0 })),
      areas: areas.map((x) => ({ area: x.area, count: x.n })),
    },
    bands: bands,
  };
}

// ── List ─────────────────────────────────────────────────────────────

export interface ListQuery extends RangeQuery {
  q?: string; status?: string; industry?: string; source?: string; band?: string; consultation?: string; opportunity?: string;
  sort?: string; dir?: string; page?: number; pageSize?: number;
}

const SORTS: Record<string, string> = {
  created: 'a.created_at', activity: 'a.last_activity_at', completed: 'a.completed_at', score: 's.overall_score', name: 'a.respondent_name',
  business: 'a.business_name', status: 'a.status',
};

export async function listAssessments(ctx: Ctx, q: ListQuery) {
  const p: unknown[] = [];
  const w: string[] = ['1=1', ...range(q, 'a.created_at', p)];
  if (q.q?.trim()) {
    p.push(`%${q.q.trim().replace(/[\\%_]/g, '\\$&')}%`);
    const n = p.length;
    w.push(`(a.respondent_name ILIKE $${n} OR a.business_name ILIKE $${n} OR a.email ILIKE $${n} OR a.mobile ILIKE $${n} OR a.public_id ILIKE $${n})`);
  }
  const eq = (col: string, v?: string) => { if (v) { p.push(v); w.push(`${col} = $${p.length}`); } };
  eq('a.status', q.status); eq('a.industry', q.industry); eq('t.first_category', q.source); eq('s.readiness_band', q.band);
  eq('a.consultation_status', q.consultation); eq('o.level', q.opportunity);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
  const page = Math.max(1, q.page ?? 1);
  const order = `${SORTS[q.sort ?? 'created'] ?? 'a.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, a.created_at DESC`;
  const from = `FROM assessments a LEFT JOIN assessment_scores s ON s.assessment_id=a.id LEFT JOIN attribution t ON t.assessment_id=a.id
                LEFT JOIN assessment_indicators o ON o.assessment_id=a.id AND o.kind='opportunity' WHERE ${w.join(' AND ')}`;
  const total = (await ctx.db.one<{ n: number }>(`SELECT count(*)::int AS n ${from}`, p))!.n;
  const rows = await ctx.db.query<any>(
    `SELECT a.public_id AS id, a.respondent_name AS name, a.business_name AS business, a.industry, a.turnover_range AS turnover, a.team_size AS "teamSize",
            a.mobile, a.email, t.first_category AS source, t.first_campaign AS campaign, a.status, a.analysis_status AS "analysisStatus", a.report_status AS "reportStatus",
            s.overall_rounded AS score, s.readiness_band AS band, o.level AS opportunity, a.completed_at AS "completedAt", a.created_at AS "createdAt",
            a.last_activity_at AS "lastActivityAt", a.consultation_status AS consultation, a.completion_percentage AS progress
     ${from} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, p);
  const industries = (await ctx.db.query<{ industry: string }>(`SELECT DISTINCT industry FROM assessments WHERE industry IS NOT NULL ORDER BY 1`)).map((r) => r.industry);
  const sources = (await ctx.db.query<{ s: string }>(`SELECT DISTINCT first_category AS s FROM attribution WHERE first_category IS NOT NULL ORDER BY 1`)).map((r) => r.s);
  return { rows, total, page, pageSize, facets: { industries, sources } };
}

// ── Detail ───────────────────────────────────────────────────────────

export async function assessmentDetail(ctx: Ctx, publicId: string) {
  const a = await ctx.db.one<AssessmentRow>('SELECT * FROM assessments WHERE public_id=$1', [publicId]);
  if (!a) throw new HttpError(404, 'Assessment not found.');
  const cfg = getConfig(a.assessment_version);
  const answers = (await getSnapshotAnswers(ctx.db, a.id)) ?? (await getAnswers(ctx.db, a.id));
  const phases = cfg.phases.map((ph) => ({
    number: ph.number, title: ph.title,
    answers: cfg.questions.filter((x) => x.phase === ph.number).map((x) => ({ id: x.id, question: x.label, type: x.type, answer: answers[x.id] ?? null, scored: x.scored })),
  }));
  const score = await ctx.db.one<{ result: ScoreResult; calculated_at: Date }>('SELECT result, calculated_at FROM assessment_scores WHERE assessment_id=$1', [a.id]);
  const analysis = await ctx.db.one<any>('SELECT status, output, error, attempts, model, provider, prompt_version AS "promptVersion", completed_at AS "completedAt" FROM ai_analysis WHERE assessment_id=$1', [a.id]);
  const report = await ctx.db.one<any>(`SELECT status, report_version AS version, pdf_bytes AS bytes, generated_at AS "generatedAt", error FROM reports WHERE assessment_id=$1 ORDER BY created_at DESC LIMIT 1`, [a.id]);
  const consultation = await ctx.db.one<any>('SELECT status, clicked_at AS "clickedAt", booked_at AS "bookedAt", booking_reference AS reference, source FROM consultations WHERE assessment_id=$1', [a.id]);
  const attribution = await ctx.db.one<any>('SELECT * FROM attribution WHERE assessment_id=$1', [a.id]);
  const events = await ctx.db.query<any>('SELECT event, props, created_at AS "at" FROM analytics_events WHERE assessment_id=$1 AND event <> $2 ORDER BY id DESC LIMIT 80', [a.id, 'question_answered']);
  const jobs = await ctx.db.query<any>('SELECT type, status, attempts, last_error AS error, created_at AS "createdAt", finished_at AS "finishedAt" FROM jobs WHERE assessment_id=$1 ORDER BY created_at DESC LIMIT 10', [a.id]);
  const messages = await ctx.db.query<any>('SELECT channel, template, status, created_at AS "at" FROM notifications WHERE assessment_id=$1 ORDER BY created_at DESC LIMIT 10', [a.id]);
  return {
    overview: {
      id: a.public_id, status: a.status, analysisStatus: a.analysis_status, reportStatus: a.report_status, consultationStatus: a.consultation_status,
      respondent: a.respondent_name, business: a.business_name, role: a.role, email: a.email, mobile: a.mobile, industry: a.industry,
      businessModel: a.business_model, turnover: a.turnover_range, teamSize: a.team_size, yearsInOperation: a.years_in_operation,
      currentPhase: a.current_phase, completion: a.completion_percentage,
      versions: { assessment: a.assessment_version, scoring: a.scoring_version, prompt: a.prompt_version, report: a.report_version },
      dates: { created: a.created_at, started: a.started_at, lastActivity: a.last_activity_at, completed: a.completed_at, analysisCompleted: a.analysis_completed_at, reportGenerated: a.report_generated_at, consultationBooked: a.consultation_booked_at },
    },
    attribution: attribution ? Object.fromEntries(Object.entries(attribution).filter(([k]) => k !== 'assessment_id')) : null,
    phases, score: score?.result ?? null, analysis, report, consultation, events, jobs, messages,
  };
}

export async function assessmentInternalId(ctx: Ctx, publicId: string): Promise<string> {
  const r = await ctx.db.one<{ id: string }>('SELECT id FROM assessments WHERE public_id=$1', [publicId]);
  if (!r) throw new HttpError(404, 'Assessment not found.');
  return r.id;
}

export async function auditTrail(ctx: Ctx, limit = 100) {
  return ctx.db.query(`SELECT admin_email AS "admin", action, entity, entity_id AS "entityId", metadata, created_at AS "at" FROM audit_logs ORDER BY id DESC LIMIT $1`, [limit]);
}
