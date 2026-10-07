import type { Answers, AssessmentConfig, Question } from '../../shared/types.ts';
import { getConfig } from '../../shared/config/index.ts';

export type Profile = 'weak' | 'mid' | 'strong';

const CONTEXT: Answers = {
  'Q1.1': 'Kiran Shah', 'Q1.2': 'Shah Precision Components', 'Q1.3': '+919876543210', 'Q1.4': 'kiran@shahprecision.example',
  'Q1.5': 'Founder', 'Q1.6': 'Manufacturing — Engineering & Metals', 'Q1.7': ['B2B', 'Manufacturing'], 'Q1.8': '₹3–10 crore', 'Q1.9': '21–50', 'Q1.10': '10–20 years',
};

function pickSingle(q: Question, profile: Profile): string {
  const map = q.scoring?.kind === 'map' ? q.scoring.map : null;
  const opts = q.options!.map((o) => o.value);
  if (!map) return opts[Math.floor(opts.length / 2)];
  const ranked = [...opts].sort((a, b) => map[a] - map[b]);
  return profile === 'weak' ? ranked[0] : profile === 'strong' ? ranked[ranked.length - 1] : ranked[Math.floor(ranked.length / 2)];
}

function pickMulti(q: Question, profile: Profile): string[] {
  const opts = q.options!.map((o) => o.value);
  const ex = q.exclusiveOptions ?? [];
  if (q.scoring?.kind === 'multi') {
    const pts = q.scoring.points;
    const sorted = [...opts].sort((a, b) => (pts[b] ?? 0) - (pts[a] ?? 0));
    if (profile === 'strong') return sorted.filter((o) => (pts[o] ?? 0) > 0 && !ex.includes(o)).slice(0, 6);
    if (profile === 'weak') { const neg = sorted.filter((o) => (pts[o] ?? 0) < 0); return neg.length ? neg.slice(0, 3) : [ex[0] ?? sorted[sorted.length - 1]]; }
    return sorted.filter((o) => (pts[o] ?? 0) > 0 && !ex.includes(o)).slice(0, 2);
  }
  if (q.scoring?.kind === 'inverse_count') return profile === 'strong' ? ['None'] : profile === 'weak' ? opts.filter((o) => o !== 'None').slice(0, 6) : ['Sales', 'Finance'];
  return opts.filter((o) => !ex.includes(o)).slice(0, 3);
}

/** Valid, complete answers for every question of the given config — used by seed data and tests. */
export function sampleAnswers(profile: Profile, cfg: AssessmentConfig = getConfig()): Answers {
  const a: Answers = {};
  for (const q of cfg.questions) {
    if (CONTEXT[q.id] !== undefined) { a[q.id] = CONTEXT[q.id]; continue; }
    switch (q.type) {
      case 'rating': a[q.id] = q.scored ? (profile === 'weak' ? 1 : profile === 'strong' ? 5 : 3) : 4; break;
      case 'single_select': a[q.id] = q.scored ? pickSingle(q, profile) : q.options![1].value; break;
      case 'multi_select': a[q.id] = pickMulti(q, profile); break;
      case 'ranking': a[q.id] = q.options!.slice(0, q.rankCount ?? q.options!.length).map((o) => o.value).reverse(); break;
      case 'long_text': a[q.id] = q.id === 'Q6.1' ? 'Orders and dispatch status live on WhatsApp and every customer follow-up needs my personal involvement; monthly reports take our accounts team three days.' : q.id === 'Q6.2' ? 'Approving routine quotations and chasing payment collections.' : 'Order processing and invoicing — it is rebuilt from scratch in Excel each time.'; break;
      default: a[q.id] = 'Sample';
    }
  }
  a['Q6.3'] = ['Data entry', 'Reporting', 'Sales follow-up'];
  a['Q3.6'] = ['Data entry', 'Order processing', 'Reporting'];
  a['Q6.6'] = ['Save time', 'Automate repetitive work', 'Analyse business information'];
  a['Q6.7'] = 4;
  return a;
}
