import "server-only";
import { randomBytes } from "node:crypto";
import pg from "pg";
import {
  BLANK_DETAILS, BLANK_OPEN, sanitiseAnswers, type Answer, type BandKey, type Details, type OpenAnswers,
} from "@/lib/scorecard";
import type { ReportContent } from "@/lib/report";

const globalForPg = globalThis as unknown as { pgPool?: pg.Pool };

export const pool =
  globalForPg.pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export type ScorecardStatus = "draft" | "scored" | "report_ready" | "report_failed";

export interface Scorecard {
  id: string;
  token: string;
  status: ScorecardStatus;
  details: Details;
  answers: Answer[];
  open: OpenAnswers;
  voiceUsed: { bottleneck?: boolean; automate?: boolean };
  total: number | null;
  pillarScores: number[] | null;
  band: BandKey | null;
  report: ReportContent | null;
  reportAttempts: number;
  hasPdf: boolean;
  whatsappSentAt: Date | null;
  emailSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const COLUMNS = `id, token, status, details, answers, bottleneck, software, automate_task, voice_used, total,
  pillar_scores, band, report, report_attempts, (pdf IS NOT NULL) AS has_pdf, whatsapp_sent_at, email_sent_at,
  created_at, updated_at`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toScorecard(r: any): Scorecard {
  return {
    id: r.id,
    token: r.token,
    status: r.status,
    details: { ...BLANK_DETAILS, ...r.details },
    answers: sanitiseAnswers(r.answers),
    open: { ...BLANK_OPEN, bottleneck: r.bottleneck, software: r.software ?? [], automate: r.automate_task },
    voiceUsed: r.voice_used ?? {},
    total: r.total,
    pillarScores: r.pillar_scores,
    band: r.band,
    report: r.report,
    reportAttempts: r.report_attempts,
    hasPdf: r.has_pdf,
    whatsappSentAt: r.whatsapp_sent_at,
    emailSentAt: r.email_sent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function countRecentStarts(deviceId: string, ipHash: string) {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE device_id = $1)::int AS device, count(*) FILTER (WHERE ip_hash = $2)::int AS ip
       FROM scorecards WHERE created_at > now() - interval '24 hours' AND (device_id = $1 OR ip_hash = $2)`,
    [deviceId, ipHash],
  );
  return rows[0] as { device: number; ip: number };
}

export async function createScorecard(deviceId: string, ipHash: string): Promise<Scorecard> {
  const token = randomBytes(24).toString("base64url");
  const { rows } = await pool.query(
    `INSERT INTO scorecards (token, device_id, ip_hash, answers) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [token, deviceId, ipHash, JSON.stringify(Array(25).fill(null))],
  );
  return toScorecard(rows[0]);
}

export async function getScorecard(token: string): Promise<Scorecard | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM scorecards WHERE token = $1`, [token]);
  return rows[0] ? toScorecard(rows[0]) : null;
}

export interface DraftPatch {
  details?: Details;
  answers?: Answer[];
  open?: OpenAnswers;
  voiceUsed?: Scorecard["voiceUsed"];
}

/** Autosave. Only drafts can change; a submitted Scorecard is locked. */
export async function saveDraft(token: string, patch: DraftPatch): Promise<Scorecard | null> {
  const { rows } = await pool.query(
    `UPDATE scorecards SET
        details       = COALESCE($2::jsonb, details),
        answers       = COALESCE($3::jsonb, answers),
        bottleneck    = COALESCE($4, bottleneck),
        software      = COALESCE($5::text[], software),
        automate_task = COALESCE($6, automate_task),
        voice_used    = COALESCE($7::jsonb, voice_used),
        consent_at    = CASE WHEN ($2::jsonb ->> 'consent')::boolean IS TRUE THEN COALESCE(consent_at, now())
                             WHEN $2::jsonb IS NOT NULL THEN NULL ELSE consent_at END,
        updated_at    = now()
      WHERE token = $1 AND status = 'draft'
      RETURNING ${COLUMNS}`,
    [
      token,
      patch.details ? JSON.stringify(patch.details) : null,
      patch.answers ? JSON.stringify(patch.answers) : null,
      patch.open?.bottleneck ?? null,
      patch.open?.software ?? null,
      patch.open?.automate ?? null,
      patch.voiceUsed ? JSON.stringify(patch.voiceUsed) : null,
    ],
  );
  return rows[0] ? toScorecard(rows[0]) : null;
}

export async function markScored(token: string, total: number, pillars: number[], band: BandKey) {
  await pool.query(
    `UPDATE scorecards SET status = 'scored', total = $2, pillar_scores = $3, band = $4, submitted_at = now(), updated_at = now()
      WHERE token = $1 AND status = 'draft'`,
    [token, total, pillars, band],
  );
}

export async function saveReport(token: string, report: ReportContent, model: string) {
  await pool.query(
    `UPDATE scorecards SET status = 'report_ready', report = $2, report_model = $3, report_error = NULL,
        report_attempts = report_attempts + 1, pdf = NULL, updated_at = now()
      WHERE token = $1`,
    [token, JSON.stringify(report), model],
  );
}

export async function markReportFailed(token: string, error: string) {
  await pool.query(
    `UPDATE scorecards SET status = 'report_failed', report_error = $2, report_attempts = report_attempts + 1, updated_at = now()
      WHERE token = $1 AND status <> 'report_ready'`,
    [token, error.slice(0, 2000)],
  );
}

export async function reportsToRetry(maxAttempts: number, limit = 10): Promise<Scorecard[]> {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM scorecards
      WHERE status = 'report_failed' AND report_attempts < $1 AND updated_at < now() - interval '1 minute'
      ORDER BY updated_at LIMIT $2`,
    [maxAttempts, limit],
  );
  return rows.map(toScorecard);
}

export async function getPdf(token: string): Promise<Buffer | null> {
  const { rows } = await pool.query(`SELECT pdf FROM scorecards WHERE token = $1`, [token]);
  return rows[0]?.pdf ?? null;
}

export async function savePdf(token: string, pdf: Buffer) {
  await pool.query(`UPDATE scorecards SET pdf = $2 WHERE token = $1`, [token, pdf]);
}

export async function markSent(token: string, channels: { whatsapp: boolean; email: boolean }) {
  await pool.query(
    `UPDATE scorecards SET
        whatsapp_sent_at = CASE WHEN $2 THEN now() ELSE whatsapp_sent_at END,
        email_sent_at    = CASE WHEN $3 THEN now() ELSE email_sent_at END
      WHERE token = $1`,
    [token, channels.whatsapp, channels.email],
  );
}

export type InterestKind = "webinar" | "audit_call" | "self_audit" | "consultant_audit";

export async function recordInterest(input: {
  kind: InterestKind;
  scorecardId?: string | null;
  name?: string;
  business?: string;
  phone?: string;
  email?: string;
}) {
  await pool.query(
    `INSERT INTO interest_requests (kind, scorecard_id, name, business, phone, email) VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.kind, input.scorecardId ?? null, input.name ?? "", input.business ?? "", input.phone ?? "", input.email ?? ""],
  );
}
