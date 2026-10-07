import type { Answer, Question } from '../../shared/types.ts';
import { isEmpty } from '../../shared/validation.ts';

const RATING_SCORE = (r: number) => ((r - 1) / 4) * 100; // 1→0, 2→25, 3→50, 4→75, 5→100
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/** Convert one answer to a 0–100 score (full precision). null = not scorable. */
export function scoreQuestion(q: Question, answer: Answer | undefined): number | null {
  if (!q.scored || !q.scoring || isEmpty(answer)) return null;
  const rule = q.scoring;
  switch (rule.kind) {
    case 'rating':
      return typeof answer === 'number' ? RATING_SCORE(answer) : null;
    case 'map': {
      if (typeof answer !== 'string') return null;
      const s = rule.map[answer];
      if (s === undefined) throw new Error(`No score mapping for ${q.id} value "${answer}"`);
      return s;
    }
    case 'multi': {
      if (!Array.isArray(answer)) return null;
      const sum = answer.reduce((acc, v) => acc + (rule.points[v] ?? 0), 0);
      return clamp((sum / rule.max) * 100);
    }
    case 'inverse_count': {
      if (!Array.isArray(answer)) return null;
      const n = answer.filter((v) => !rule.ignore.includes(v)).length;
      return clamp((1 - n / rule.total) * 100);
    }
    case 'numeric': {
      if (typeof answer !== 'number') return null;
      const t = clamp(((answer - rule.min) / (rule.max - rule.min)) * 100);
      return rule.invert ? 100 - t : t;
    }
  }
}

