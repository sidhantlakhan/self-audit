import type { Answer, Answers, AssessmentConfig, Question } from './types.ts';
import { questionIndex } from './config/index.ts';

const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

/** Normalise to E.164. Returns null when the number is not plausible. */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim().replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) {
    const d = s.slice(1);
    if (!/^\d{8,15}$/.test(d) || d.startsWith('0')) return null;
    if (d.startsWith('91') && !/^91[6-9]\d{9}$/.test(d)) return null; // Indian numbers must be valid mobiles
    return '+' + d;
  }
  if (s.startsWith('00') && /^00\d{9,16}$/.test(s)) return normalizePhone('+' + s.slice(2));
  if (/^[6-9]\d{9}$/.test(s)) return '+91' + s;
  if (/^0[6-9]\d{9}$/.test(s)) return '+91' + s.slice(1);
  if (/^91[6-9]\d{9}$/.test(s)) return '+' + s;
  return null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmpty(v: Answer | undefined): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Returns an error message, or null when the value is acceptable. Empty optional answers are valid. */
export function validateAnswer(question: Question, value: Answer | undefined): string | null {
  const v = question.validation ?? {};
  if (isEmpty(value)) return question.required ? 'This question is required.' : null;
  const optionValues = new Set((question.options ?? []).map((x) => x.value));

  switch (question.type) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string') return 'Enter text.';
      const t = value.trim();
      if (v.minLength && t.length < v.minLength) return `Please enter at least ${v.minLength} characters.`;
      if (v.maxLength && t.length > v.maxLength) return `Please keep this within ${v.maxLength} characters.`;
      return null;
    }
    case 'email': {
      if (typeof value !== 'string') return 'Enter a valid email address.';
      const e = value.trim();
      if (e.length > (v.maxLength ?? 254) || !EMAIL_RE.test(e)) return 'Enter a valid email address.';
      return null;
    }
    case 'phone': {
      if (typeof value !== 'string' || !normalizePhone(value)) return 'Enter a valid mobile number, for example 98765 43210 or +44 7700 900123.';
      return null;
    }
    case 'single_select':
      if (typeof value !== 'string' || !optionValues.has(value)) return 'Choose one of the listed options.';
      return null;
    case 'multi_select': {
      if (!Array.isArray(value) || value.some((x) => typeof x !== 'string' || !optionValues.has(x))) return 'Choose from the listed options.';
      if (new Set(value).size !== value.length) return 'Duplicate selections are not allowed.';
      const ex = question.exclusiveOptions ?? [];
      if (value.length > 1 && value.some((x) => ex.includes(x))) return `“${value.find((x) => ex.includes(x))}” cannot be combined with other options.`;
      return null;
    }
    case 'rating': {
      const min = v.min ?? 1;
      const max = v.max ?? 5;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return `Choose a rating from ${min} to ${max}.`;
      return null;
    }
    case 'numeric': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
      if (v.min !== undefined && value < v.min) return `Enter a value of at least ${v.min}.`;
      if (v.max !== undefined && value > v.max) return `Enter a value of at most ${v.max}.`;
      return null;
    }
    case 'ranking': {
      const n = question.rankCount ?? optionValues.size;
      if (!Array.isArray(value) || value.some((x) => typeof x !== 'string' || !optionValues.has(x))) return 'Choose from the listed options.';
      if (new Set(value).size !== value.length) return 'Each option can be ranked only once.';
      if (value.length !== n) return `Rank exactly ${n} options.`;
      return null;
    }
  }
}

export function isVisible(question: Question, answers: Answers): boolean {
  const c = question.displayIf;
  if (!c) return true;
  const a = answers[c.questionId];
  if (c.includes !== undefined) return Array.isArray(a) ? a.includes(c.includes) : a === c.includes;
  if (c.equals !== undefined) return a === c.equals;
  return true;
}

/** Validate a partial patch of answers (autosave). Unknown ids and invalid values are rejected. */
export function validatePatch(cfg: AssessmentConfig, patch: Record<string, Answer>): { ok: Answers; errors: Record<string, string> } {
  const idx = questionIndex(cfg);
  const ok: Answers = {};
  const errors: Record<string, string> = {};
  for (const [id, value] of Object.entries(patch)) {
    const q = idx.get(id);
    if (!q) {
      errors[id] = 'Unknown question.';
      continue;
    }
    // Autosave stores in-progress text: only the "shape" is enforced here; completeness is enforced at phase completion.
    if (isEmpty(value)) {
      ok[id] = null;
      continue;
    }
    const partial: Question = {
      ...q, required: false,
      validation: q.type === 'long_text' || q.type === 'short_text' ? { maxLength: q.validation?.maxLength } : q.validation,
    };
    if (q.type === 'ranking' && Array.isArray(value) && value.length < (q.rankCount ?? Infinity)) partial.rankCount = value.length; // a ranking in progress
    const err = validateAnswer(partial, value);
    if (err) errors[id] = err;
    else ok[id] = typeof value === 'string' ? value.trim() : value;
  }
  return { ok, errors };
}

/** Full validation of a set of questions, e.g. one phase or the whole assessment. */
export function validateQuestions(questions: Question[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    if (!isVisible(q, answers)) continue;
    const err = validateAnswer(q, answers[q.id]);
    if (err) errors[q.id] = err;
  }
  return errors;
}

export function completionPercentage(cfg: AssessmentConfig, answers: Answers): number {
  const required = cfg.questions.filter((q) => q.required && isVisible(q, answers));
  if (!required.length) return 100;
  const done = required.filter((q) => !isEmpty(answers[q.id]) && validateAnswer(q, answers[q.id]) === null).length;
  return Math.round((done / required.length) * 100);
}
