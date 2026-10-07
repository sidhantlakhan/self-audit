import type { Answers, AssessmentConfig, FounderDependency } from '../../shared/types.ts';
import { scoreQuestion } from './question.ts';

const asArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/**
 * Founder dependency profile — derived from Q2.2, Q2.4, Q2.5, Q2.7, Q2.8 (and Q2.3 as a signal).
 * Index is 0..100 where higher = more dependent. Presented as a profile, not a headline score.
 */
export function computeFounderDependency(cfg: AssessmentConfig, answers: Answers): FounderDependency {
  const q = (id: string) => cfg.questions.find((x) => x.id === id)!;
  const inv = (id: string) => {
    const s = scoreQuestion(q(id), answers[id]);
    return s === null ? null : 100 - s;
  };
  const founderKnowledge = asArray(answers['Q2.5']).includes('Founder knowledge') ? 100 : 0;
  const parts: { v: number | null; w: number }[] = [
    { v: inv('Q2.2'), w: 1.5 },
    { v: inv('Q2.4'), w: 1.5 },
    { v: inv('Q2.7'), w: 1.5 },
    { v: asArray(answers['Q2.5']).length ? founderKnowledge : null, w: 1 },
    { v: inv('Q2.8'), w: 1 },
  ];
  const used = parts.filter((p) => p.v !== null) as { v: number; w: number }[];
  const wsum = used.reduce((a, p) => a + p.w, 0);
  const index = wsum ? used.reduce((a, p) => a + p.v * p.w, 0) / wsum : 0;
  const level = index < 25 ? 'low' : index < 50 ? 'moderate' : index < 70 ? 'high' : 'very_high';
  const label = { low: 'Low founder dependency', moderate: 'Moderate founder dependency', high: 'High founder dependency', very_high: 'Very high founder dependency' }[level];

  const signals: string[] = [];
  const involvement = answers['Q2.2'];
  if (involvement === 'Daily' || involvement === 'Multiple times a day') signals.push(`The founder is involved in operational decisions ${String(involvement).toLowerCase()}.`);
  else if (involvement === 'Several times a week') signals.push('The founder is involved in operational decisions several times a week.');
  const continuity = answers['Q2.4'];
  if (continuity && continuity !== 'Business would operate normally' && continuity !== 'Minor delays') signals.push(`If the founder were unavailable for two weeks: “${continuity}”.`);
  const deps = asArray(answers['Q2.7']).filter((x) => x !== 'None');
  if (deps.length) signals.push(`Founder remains a dependency in ${deps.length} function${deps.length > 1 ? 's' : ''}: ${deps.join(', ')}.`);
  if (founderKnowledge) signals.push('Knowledge needed to run the business sits with the founder.');
  if (asArray(answers['Q2.3']).includes('None')) signals.push('The team has no decision authority without the founder.');
  const deleg = answers['Q2.8'];
  if (typeof deleg === 'number' && deleg <= 2) signals.push(`Confidence that responsibilities can be delegated without losing control is low (${deleg} of 5).`);
  return { index, level, label, signals };
}
