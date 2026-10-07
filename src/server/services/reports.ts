import type { Ctx } from '../lib/context.ts';
import { getConfig } from '../../shared/config/index.ts';
import type { ScoreResult } from '../../shared/types.ts';
import type { Analysis } from '../ai/schema.ts';
import { REPORT_VERSION, renderReportHtml, type ReportData } from '../report/render.ts';
import { htmlToPdf } from '../report/pdf.ts';
import { advanceStatus, resumeLink, issueToken, type AssessmentRow } from './assessments.ts';
import { buildBookingUrl } from './consultation.ts';
import { track } from './analytics.ts';
import { notify } from './notifications.ts';

export function dataFromSnapshots(a: AssessmentRow, score: ScoreResult, analysis: Analysis, bookingUrl: string, generatedAt: Date): ReportData {
  const cfg = getConfig(a.assessment_version);
  return {
    assessmentId: a.public_id, generatedAt,
    respondentName: a.respondent_name ?? '', businessName: a.business_name ?? '', role: a.role ?? '', industry: a.industry ?? '',
    businessModel: a.business_model ?? [], turnoverRange: a.turnover_range ?? '', teamSize: a.team_size ?? '', yearsInOperation: a.years_in_operation ?? '',
    completedAt: a.completed_at ?? generatedAt, score, analysis, bandDefs: cfg.bands, bookingUrl,
  };
}

/**
 * Generates (or regenerates) the PDF. Reproducible: it renders from the stored score and AI-analysis snapshots,
 * so later changes to scoring or prompts never alter a historical report.
 */
export async function generateReport(ctx: Ctx, assessmentId: string): Promise<void> {
  const a = await ctx.db.one<AssessmentRow>('SELECT * FROM assessments WHERE id=$1', [assessmentId]);
  if (!a) return;
  const done = await ctx.db.one<{ status: string }>('SELECT status FROM reports WHERE assessment_id=$1 AND report_version=$2', [assessmentId, REPORT_VERSION]);
  if (done?.status === 'complete') return; // idempotent
  const sc = await ctx.db.one<{ result: ScoreResult }>('SELECT result FROM assessment_scores WHERE assessment_id=$1', [assessmentId]);
  const an = await ctx.db.one<{ output: Analysis }>(`SELECT output FROM ai_analysis WHERE assessment_id=$1 AND status='complete'`, [assessmentId]);
  if (!sc || !an) throw new Error('Report requires a score and a completed AI analysis');

  await ctx.db.query(
    `INSERT INTO reports (assessment_id, report_version, status) VALUES ($1,$2,'processing')
     ON CONFLICT (assessment_id, report_version) DO UPDATE SET status='processing', error=NULL`, [assessmentId, REPORT_VERSION]);
  await ctx.db.query(`UPDATE assessments SET report_status='processing', report_version=$2 WHERE id=$1`, [assessmentId, REPORT_VERSION]);

  const generatedAt = new Date();
  const bookingUrl = await buildBookingUrl(ctx, a);
  const html = renderReportHtml(dataFromSnapshots(a, sc.result, an.output, bookingUrl, generatedAt));
  const pdf = await htmlToPdf(html);

  await ctx.db.tx(async (t) => {
    await t.query(
      `UPDATE reports SET status='complete', pdf=$3, pdf_bytes=$4, score_snapshot=$5, analysis_snapshot=$6, generated_at=$7, error=NULL WHERE assessment_id=$1 AND report_version=$2`,
      [assessmentId, REPORT_VERSION, pdf, pdf.length, JSON.stringify(sc.result), JSON.stringify(an.output), generatedAt]);
    await t.query(`UPDATE assessments SET report_status='complete', report_generated_at=$2 WHERE id=$1`, [assessmentId, generatedAt]);
    await advanceStatus(t, assessmentId, 'report_complete');
  });
  await track(ctx, { event: 'report_generated', assessmentId });
  if (a.email) {
    const token = await issueToken(ctx, assessmentId);
    await notify(ctx, { assessmentId, template: 'report_available', email: a.email, mobile: a.mobile, vars: { name: a.respondent_name ?? '', link: resumeLink(ctx, a.public_id, token, '/result') } });
  }
}

export async function markReportFailed(ctx: Ctx, assessmentId: string, error: string): Promise<void> {
  await ctx.db.query(`UPDATE reports SET status='failed', error=$3 WHERE assessment_id=$1 AND report_version=$2`, [assessmentId, REPORT_VERSION, error.slice(0, 400)]);
  await ctx.db.query(`UPDATE assessments SET report_status='failed' WHERE id=$1`, [assessmentId]);
}

export async function getReportPdf(ctx: Ctx, assessmentId: string): Promise<Buffer | null> {
  const r = await ctx.db.one<{ pdf: Uint8Array | null }>(`SELECT pdf FROM reports WHERE assessment_id=$1 AND status='complete' ORDER BY generated_at DESC LIMIT 1`, [assessmentId]);
  return r?.pdf ? Buffer.from(r.pdf) : null;
}

/** Admin regenerate: creates a fresh PDF for the current report version from current stored data. */
export async function regenerateReport(ctx: Ctx, assessmentId: string): Promise<void> {
  await ctx.db.tx(async (t) => {
    await t.query(`DELETE FROM reports WHERE assessment_id=$1 AND report_version=$2 AND status IN ('failed','pending')`, [assessmentId, REPORT_VERSION]);
    await t.query(`UPDATE reports SET status='pending' WHERE assessment_id=$1 AND report_version=$2`, [assessmentId, REPORT_VERSION]);
    await t.query(`UPDATE assessments SET report_status='pending' WHERE id=$1 AND report_status IN ('failed','complete')`, [assessmentId]);
    const { enqueueJob } = await import('../jobs/queue.ts');
    await enqueueJob(t, 'report', assessmentId);
  });
}
