import type { Ctx } from '../lib/context.ts';
import { getConfig } from '../../shared/config/index.ts';
import type { ScoreResult } from '../../shared/types.ts';
import { sha256, stableStringify } from '../lib/crypto.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT_V1, buildUserPrompt } from '../ai/prompts.ts';
import { AnalysisSchema, type Analysis } from '../ai/schema.ts';
import { lintAnalysis } from '../ai/guardrails.ts';
import type { AnalysisInput } from '../ai/provider.ts';
import { weakestQuestions } from '../scoring/engine.ts';
import { advanceStatus, getSnapshotAnswers, type AssessmentRow } from './assessments.ts';
import { track } from './analytics.ts';
import { enqueueJob } from '../jobs/queue.ts';

export function buildAnalysisInput(a: AssessmentRow, answers: Record<string, any>, score: ScoreResult): AnalysisInput {
  const cfg = getConfig(a.assessment_version);
  const dimLabel = new Map(cfg.dimensions.map((d) => [d.id as string, d.label]));
  return {
    // Deliberately excluded: name, business name, mobile, email, any internal ids.
    context: {
      role: a.role, industry: a.industry, businessModel: a.business_model, turnoverRange: a.turnover_range,
      teamSize: a.team_size, yearsInOperation: a.years_in_operation,
    },
    readiness: {
      overallScore: score.overallRounded,
      band: score.band.label,
      dimensions: score.dimensions.map((d) => ({ id: d.dimension, label: d.label, score: Math.round(d.score), weightPercent: Math.round(d.weight * 100) })),
      weakestAnswers: weakestQuestions(cfg, score, 5).map((w) => ({ question: w.label, score: Math.round(w.score) })),
    },
    indicators: {
      founderDependency: { level: score.founderDependency.level, signals: score.founderDependency.signals },
      opportunity: {
        level: score.opportunity.level,
        areas: score.opportunity.areas.map((x) => ({ area: x.label, strength: x.strength, basis: x.sources })),
        priorityOutcomes: score.opportunity.priorityOutcomes,
        expectations: score.opportunity.expectations,
      },
      aiAdoptionIntent: { rating: score.adoptionIntent.rating, label: score.adoptionIntent.label },
    },
    responses: cfg.questions
      .filter((q) => q.aiRelevant && q.phase > 1 && answers[q.id] !== undefined && answers[q.id] !== null)
      .map((q) => ({ id: q.id, dimension: dimLabel.get(q.dimension) ?? 'Business context', question: q.label, answer: answers[q.id] })),
  };
}

function parseJson(text: string): unknown {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('Model output did not contain a JSON object');
  return JSON.parse(text.slice(s, e + 1));
}

export class AnalysisRejected extends Error {}

/** Runs the AI interpretation for a completed assessment. Throws on failure (the job queue handles retry). */
export async function runAnalysis(ctx: Ctx, assessmentId: string): Promise<void> {
  const a = await ctx.db.one<AssessmentRow>('SELECT * FROM assessments WHERE id=$1', [assessmentId]);
  if (!a) return;
  const existing = await ctx.db.one<{ status: string }>('SELECT status FROM ai_analysis WHERE assessment_id=$1', [assessmentId]);
  if (existing?.status === 'complete') return; // idempotent
  const scoreRow = await ctx.db.one<{ result: ScoreResult }>('SELECT result FROM assessment_scores WHERE assessment_id=$1', [assessmentId]);
  const answers = await getSnapshotAnswers(ctx.db, assessmentId);
  if (!scoreRow || !answers) throw new Error('Cannot analyse an assessment without a score and snapshot');
  const score = scoreRow.result;

  const input = buildAnalysisInput(a, answers, score);
  const inputHash = sha256(stableStringify(input) + PROMPT_VERSION);
  await ctx.db.query(`UPDATE ai_analysis SET status='processing', attempts=attempts+1, model=$2, provider=$3, input_hash=$4, input_snapshot=$5, error=NULL WHERE assessment_id=$1`,
    [assessmentId, ctx.ai.model, ctx.ai.name, inputHash, JSON.stringify(input)]);
  await ctx.db.query(`UPDATE assessments SET analysis_status='processing' WHERE id=$1`, [assessmentId]);
  await track(ctx, { event: 'analysis_started', assessmentId });

  const lintCtx = {
    respondentText: JSON.stringify(answers),
    knownScores: [score.overallRounded, ...score.dimensions.map((d) => Math.round(d.score)), ...input.readiness.weakestAnswers.map((w) => w.score)],
    turnoverLabel: a.turnover_range ?? '',
  };
  const user = buildUserPrompt(input);
  let output: Analysis | null = null;
  let lastProblem = '';
  for (let attempt = 0; attempt < 2 && !output; attempt++) {
    const prompt = attempt === 0 ? user : `${user}\n\nYour previous output was rejected: ${lastProblem}\nRegenerate the JSON, resolving every issue.`;
    const raw = await ctx.ai.generate({ system: SYSTEM_PROMPT_V1, user: prompt, input });
    let parsed: unknown;
    try { parsed = parseJson(raw); } catch (e) { lastProblem = (e as Error).message; continue; }
    const valid = AnalysisSchema.safeParse(parsed);
    if (!valid.success) { lastProblem = `schema: ${valid.error.issues.slice(0, 3).map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`; continue; }
    const problems = lintAnalysis(valid.data, lintCtx);
    if (problems.length) { lastProblem = problems.slice(0, 4).join(' | '); continue; }
    output = valid.data;
  }
  if (!output) throw new AnalysisRejected(`AI output rejected: ${lastProblem}`.slice(0, 400));

  await ctx.db.tx(async (t) => {
    await t.query(`UPDATE ai_analysis SET status='complete', output=$2, completed_at=now(), error=NULL WHERE assessment_id=$1`, [assessmentId, JSON.stringify(output)]);
    await t.query(`UPDATE assessments SET analysis_status='complete', analysis_completed_at=now(), report_status='pending' WHERE id=$1`, [assessmentId]);
    await advanceStatus(t, assessmentId, 'analysis_complete');
    await enqueueJob(t, 'report', assessmentId);
    await advanceStatus(t, assessmentId, 'report_pending');
  });
  await track(ctx, { event: 'analysis_completed', assessmentId });
}

/** Called by the queue when retries are exhausted. The deterministic result remains available. */
export async function markAnalysisFailed(ctx: Ctx, assessmentId: string, error: string): Promise<void> {
  await ctx.db.query(`UPDATE ai_analysis SET status='failed', error=$2 WHERE assessment_id=$1`, [assessmentId, error.slice(0, 400)]);
  await ctx.db.query(`UPDATE assessments SET analysis_status='failed' WHERE id=$1`, [assessmentId]);
}

/** Admin retry: reset analysis and queue it again. */
export async function retryAnalysis(ctx: Ctx, assessmentId: string): Promise<void> {
  await ctx.db.tx(async (t) => {
    await t.query(`UPDATE ai_analysis SET status='pending', error=NULL WHERE assessment_id=$1 AND status IN ('failed','pending')`, [assessmentId]);
    await t.query(`UPDATE assessments SET analysis_status='pending' WHERE id=$1 AND analysis_status='failed'`, [assessmentId]);
    await enqueueJob(t, 'analysis', assessmentId, { reset: true });
  });
}
