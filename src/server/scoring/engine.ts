import type { Answers, AssessmentConfig, DimensionScore, QuestionScore, ScoreResult } from '../../shared/types.ts';
import { scoreQuestion } from './question.ts';
import { computeFounderDependency } from './founder.ts';
import { computeOpportunity, computeAdoptionIntent } from './opportunity.ts';

export function bandFor(cfg: AssessmentConfig, overall: number) {
  const rounded = Math.round(overall); // bands apply to the score as displayed
  const band = cfg.bands.find((b) => rounded >= b.min && rounded <= b.max) ?? cfg.bands[cfg.bands.length - 1];
  return { id: band.id, label: band.label, summary: band.summary };
}

export function computeDimensionScores(cfg: AssessmentConfig, answers: Answers): DimensionScore[] {
  return cfg.dimensions.map((d) => {
    const questions: QuestionScore[] = [];
    for (const q of cfg.questions) {
      if (q.dimension !== d.id || !q.scored) continue;
      const s = scoreQuestion(q, answers[q.id]);
      if (s !== null) questions.push({ questionId: q.id, dimension: d.id, score: s, weight: q.weight });
    }
    const totalWeight = questions.reduce((a, x) => a + x.weight, 0);
    const score = totalWeight ? questions.reduce((a, x) => a + x.score * x.weight, 0) / totalWeight : 0;
    return { dimension: d.id, label: d.label, score, weight: d.weight, answered: questions.length, questions };
  });
}

/**
 * Deterministic scoring. Pure function: same answers + same config ⇒ identical result.
 * Nothing in here calls AI, reads the clock, or touches I/O.
 */
export function scoreAssessment(cfg: AssessmentConfig, answers: Answers): ScoreResult {
  const dimensions = computeDimensionScores(cfg, answers);
  const weightSum = cfg.dimensions.reduce((a, d) => a + d.weight, 0);
  const overall = dimensions.reduce((a, d) => a + d.score * d.weight, 0) / weightSum;
  const band = bandFor(cfg, overall);
  const founderDependency = computeFounderDependency(cfg, answers);
  const opportunity = computeOpportunity(cfg, answers);
  const adoptionIntent = computeAdoptionIntent(answers);
  const readinessHigh = Math.round(overall) >= 51;
  const oppHigh = opportunity.level !== 'limited';
  const profile = readinessHigh
    ? oppHigh ? { key: 'aligned', label: 'Readiness and opportunity aligned' } : { key: 'readiness_ahead', label: 'Readiness ahead of immediate opportunity' }
    : oppHigh ? { key: 'opportunity_ahead', label: 'Opportunity ahead of readiness' } : { key: 'early', label: 'Early on both readiness and opportunity' };
  return {
    scoringVersion: cfg.scoringVersion,
    assessmentVersion: cfg.version,
    overall,
    overallRounded: Math.round(overall),
    band,
    dimensions,
    founderDependency,
    opportunity,
    adoptionIntent,
    profile,
  };
}

/** Lowest-scoring questions across scored dimensions, used as deterministic evidence for gaps. */
export function weakestQuestions(cfg: AssessmentConfig, score: ScoreResult, limit = 6) {
  const byId = new Map(cfg.questions.map((q) => [q.id, q]));
  return score.dimensions
    .flatMap((d) => d.questions)
    .filter((x) => x.score <= 40)
    .sort((a, b) => a.score - b.score || a.questionId.localeCompare(b.questionId))
    .slice(0, limit)
    .map((x) => ({ ...x, label: byId.get(x.questionId)!.label }));
}

export { scoreQuestion };
