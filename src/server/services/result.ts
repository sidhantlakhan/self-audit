import type { Ctx } from '../lib/context.ts';
import { getConfig } from '../../shared/config/index.ts';
import type { ScoreResult } from '../../shared/types.ts';
import type { AssessmentRow } from './assessments.ts';
import { weakestQuestions } from '../scoring/engine.ts';
import { buildBookingUrl } from './consultation.ts';

/** The user-facing result. Deterministic parts are always present; the AI interpretation is added when ready. */
export async function getResult(ctx: Ctx, a: AssessmentRow) {
  const cfg = getConfig(a.assessment_version);
  const sc = await ctx.db.one<{ result: ScoreResult }>('SELECT result FROM assessment_scores WHERE assessment_id=$1', [a.id]);
  if (!sc) throw new Error('Completed assessment has no score');
  const s = sc.result;
  const an = await ctx.db.one<{ output: unknown }>(`SELECT output FROM ai_analysis WHERE assessment_id=$1 AND status='complete'`, [a.id]);
  const dims = new Map(cfg.dimensions.map((d) => [d.id as string, d]));
  return {
    id: a.public_id,
    respondent: a.respondent_name,
    business: a.business_name,
    completedAt: a.completed_at,
    status: a.status,
    analysisStatus: a.analysis_status,
    reportStatus: a.report_status,
    consultationStatus: a.consultation_status,
    score: {
      overall: s.overallRounded,
      band: s.band,
      bands: cfg.bands.map((b) => ({ id: b.id, label: b.label, min: b.min, max: b.max })),
      dimensions: s.dimensions.map((d) => ({ id: d.dimension, label: d.label, short: dims.get(d.dimension)!.short, description: dims.get(d.dimension)!.description, score: Math.round(d.score), weight: Math.round(d.weight * 100) })),
      founderDependency: { level: s.founderDependency.level, label: s.founderDependency.label, signals: s.founderDependency.signals },
      opportunity: { level: s.opportunity.level, label: s.opportunity.label, areas: s.opportunity.areas, priorityOutcomes: s.opportunity.priorityOutcomes },
      adoptionIntent: s.adoptionIntent,
      profile: s.profile,
      // Deterministic evidence shown while (or if) the AI interpretation is unavailable.
      lowestAreas: [...s.dimensions].sort((x, y) => x.score - y.score).slice(0, 2).map((d) => ({ id: d.dimension, label: d.label, score: Math.round(d.score) })),
      weakestAnswers: weakestQuestions(cfg, s, 4).map((w) => ({ id: w.questionId, label: w.label, score: Math.round(w.score) })),
    },
    analysis: an?.output ?? null,
    bookingUrl: await buildBookingUrl(ctx, a).catch(() => null),
  };
}
