import { describe, expect, it } from 'vitest';
import { getConfig } from '../src/shared/config/index.ts';
import { scoreAssessment, scoreQuestion, bandFor } from '../src/server/scoring/engine.ts';
import { computeFounderDependency } from '../src/server/scoring/founder.ts';
import { computeOpportunity } from '../src/server/scoring/opportunity.ts';
import { sampleAnswers } from '../src/server/dev/sample-answers.ts';

const cfg = getConfig();
const q = (id: string) => cfg.questions.find((x) => x.id === id)!;

describe('configuration integrity', () => {
  it('has every specified question and six phases', () => {
    expect(cfg.phases).toHaveLength(6);
    const expected = [...Array(10)].map((_, i) => `Q1.${i + 1}`)
      .concat([...Array(8)].map((_, i) => `Q2.${i + 1}`), [...Array(8)].map((_, i) => `Q3.${i + 1}`), [...Array(10)].map((_, i) => `Q4.${i + 1}`),
        [...Array(12)].map((_, i) => `Q5.${i + 1}`), [...Array(7)].map((_, i) => `Q6.${i + 1}`));
    expect(cfg.questions.map((x) => x.id)).toEqual(expected);
  });
  it('dimension weights sum to 100%', () => {
    expect(cfg.dimensions.reduce((a, d) => a + d.weight, 0)).toBeCloseTo(1, 10);
    expect(cfg.dimensions.map((d) => d.weight)).toEqual([0.15, 0.25, 0.3, 0.2, 0.1]);
  });
  it('every scored single-select option has a mapping', () => {
    for (const x of cfg.questions.filter((y) => y.scored && y.scoring?.kind === 'map')) {
      for (const o of x.options!) expect(x.scoring && 'map' in x.scoring && x.scoring.map[o.value], `${x.id} ${o.value}`).toBeTypeOf('number');
    }
  });
  it('contextual questions are not scored (Q4.9, Q4.10, Q5.7, Q5.8, phase 1, phase 6)', () => {
    for (const id of ['Q4.9', 'Q4.10', 'Q5.7', 'Q5.8', 'Q6.7', 'Q3.6', 'Q6.1', 'Q6.4']) expect(q(id).scored).toBe(false);
    expect(cfg.questions.filter((x) => x.phase === 1 || x.phase === 6).some((x) => x.scored)).toBe(false);
  });
});

describe('question normalisation', () => {
  it('maps ratings 1..5 to 0,25,50,75,100', () => {
    expect([1, 2, 3, 4, 5].map((r) => scoreQuestion(q('Q2.1'), r))).toEqual([0, 25, 50, 75, 100]);
  });
  it('uses explicit per-question mappings, not a shared scale', () => {
    expect(scoreQuestion(q('Q2.2'), 'Almost never')).toBe(100); // less founder involvement = better
    expect(scoreQuestion(q('Q3.3'), 'Almost always')).toBe(100); // more enablement = better
    expect(scoreQuestion(q('Q4.6'), 'Never')).toBe(100); // never duplicate entry = better
  });
  it('scores multi-select with configured points, clamped 0..100', () => {
    expect(scoreQuestion(q('Q2.3'), ['None'])).toBe(0);
    expect(scoreQuestion(q('Q2.3'), ['Customer handling', 'Purchasing'])).toBe(40);
    expect(scoreQuestion(q('Q2.5'), ['Founder knowledge'])).toBe(0); // negative points clamp at 0
    expect(scoreQuestion(q('Q4.1'), ['ERP', 'CRM', 'Tally', 'Zoho', 'Busy'])).toBe(100);
  });
  it('scores founder-dependency areas inversely', () => {
    expect(scoreQuestion(q('Q2.7'), ['None'])).toBe(100);
    expect(scoreQuestion(q('Q2.7'), ['Sales', 'Finance', 'HR'])).toBeCloseTo(66.67, 1);
  });
  it('does not score unscored or unanswered questions', () => {
    expect(scoreQuestion(q('Q4.9'), 'Embedded into important workflows')).toBeNull();
    expect(scoreQuestion(q('Q2.1'), undefined)).toBeNull();
  });
});

describe('dimension and overall scores', () => {
  it('worst answers score near 0 and best answers near 100', () => {
    const worst = scoreAssessment(cfg, sampleAnswers('weak'));
    const best = scoreAssessment(cfg, sampleAnswers('strong'));
    expect(worst.overall).toBeLessThan(10);
    expect(best.overall).toBeGreaterThan(90);
    expect(worst.band.id).toBe('foundation');
    expect(best.band.id).toBe('advanced');
  });
  it('overall equals the weighted sum of dimension scores at full precision', () => {
    const r = scoreAssessment(cfg, sampleAnswers('mid'));
    const manual = r.dimensions.reduce((a, d) => a + d.score * d.weight, 0);
    expect(r.overall).toBeCloseTo(manual, 10);
    expect(r.dimensions).toHaveLength(5);
    // five independent dimensions, Phase 5 feeds two of them
    expect(r.dimensions.find((d) => d.dimension === 'people_controls_governance')!.questions.map((x) => x.questionId)).toEqual(['Q5.1', 'Q5.2', 'Q5.3', 'Q5.4', 'Q5.5', 'Q5.6']);
    expect(r.dimensions.find((d) => d.dimension === 'performance_business_control')!.questions.map((x) => x.questionId)).toEqual(['Q5.9', 'Q5.10', 'Q5.11', 'Q5.12']);
  });
  it('applies question weights within a dimension', () => {
    const a = { ...sampleAnswers('mid'), 'Q2.2': 'Almost never', 'Q2.1': 1 };
    const d = scoreAssessment(cfg, a).dimensions[0];
    const q22 = d.questions.find((x) => x.questionId === 'Q2.2')!;
    expect(q22.weight).toBe(1.5);
    const expected = d.questions.reduce((s, x) => s + x.score * x.weight, 0) / d.questions.reduce((s, x) => s + x.weight, 0);
    expect(d.score).toBeCloseTo(expected, 10);
  });
  it('is deterministic: identical answers give identical scores', () => {
    const a = sampleAnswers('mid');
    expect(JSON.stringify(scoreAssessment(cfg, a))).toBe(JSON.stringify(scoreAssessment(cfg, structuredClone(a))));
  });
  it('is not affected by contextual answers (AI adoption, tools, intent, free text)', () => {
    const base = sampleAnswers('mid');
    const other = { ...base, 'Q4.9': 'Embedded into important workflows', 'Q4.10': ['ChatGPT', 'Claude'], 'Q6.7': 1, 'Q6.1': 'A completely different bottleneck.', 'Q5.7': 1, 'Q5.8': ['Pricing'] };
    expect(scoreAssessment(cfg, other).overall).toBe(scoreAssessment(cfg, base).overall);
  });
});

describe('readiness bands', () => {
  it.each([[0, 'foundation'], [30, 'foundation'], [30.4, 'foundation'], [31, 'emerging'], [50, 'emerging'], [51, 'developing'], [70, 'developing'], [71, 'ready'], [85, 'ready'], [86, 'advanced'], [100, 'advanced']])('score %s → %s', (s, id) => {
    expect(bandFor(cfg, s as number).id).toBe(id);
  });
  it('bands come from configuration', () => {
    const custom = { ...cfg, bands: [{ id: 'low', label: 'Low', min: 0, max: 60, summary: '' }, { id: 'high', label: 'High', min: 61, max: 100, summary: '' }] };
    expect(bandFor(custom, 55).id).toBe('low');
  });
});

describe('founder dependency indicator', () => {
  it('is very high when the business revolves around the founder', () => {
    const f = computeFounderDependency(cfg, sampleAnswers('weak'));
    expect(f.level).toBe('very_high');
    expect(f.signals.length).toBeGreaterThan(2);
  });
  it('is low when responsibilities are distributed', () => {
    const f = computeFounderDependency(cfg, sampleAnswers('strong'));
    expect(f.level).toBe('low');
    expect(f.index).toBeLessThan(25);
  });
});

describe('opportunity profile', () => {
  it('derives areas from repetitive work, expectations and the respondent’s own words', () => {
    const o = computeOpportunity(cfg, sampleAnswers('mid'));
    const labels = o.areas.map((x) => x.label);
    expect(labels).toContain('Management reporting');
    expect(labels).toContain('Data capture & entry');
    expect(o.areas[0].strength).toBe('strong');
    expect(o.level).toBe('high');
    expect(o.priorityOutcomes).toHaveLength(3);
  });
  it('reports limited opportunity when there are no signals', () => {
    const none = { ...sampleAnswers('mid'), 'Q3.6': ['None'], 'Q6.3': ['None'], 'Q6.6': ['Not sure yet'], 'Q6.1': 'Nothing in particular at the moment.', 'Q6.2': '', 'Q6.5': '' };
    const o = computeOpportunity(cfg, none);
    expect(o.level).toBe('limited');
  });
  it('keeps readiness and opportunity as separate facts (2×2 profile)', () => {
    expect(scoreAssessment(cfg, sampleAnswers('weak')).profile.key).toMatch(/opportunity_ahead|early/);
    expect(scoreAssessment(cfg, sampleAnswers('strong')).profile.key).toMatch(/aligned|readiness_ahead/);
  });
  it('labels adoption intent separately from readiness', () => {
    const r = scoreAssessment(cfg, { ...sampleAnswers('mid'), 'Q6.7': 5 });
    expect(r.adoptionIntent).toEqual({ rating: 5, label: 'Very strong intent' });
  });
});
