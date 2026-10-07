import type { Answers, AdoptionIntent, AssessmentConfig, OpportunityArea, OpportunityProfile } from '../../shared/types.ts';

const asArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Opportunity areas. Activity answers map 1:1; expectations and free text map through the tables below. */
const AREAS: Record<string, string> = {
  'Data entry': 'Data capture & entry',
  'Sales follow-up': 'Sales follow-up',
  'Customer communication': 'Customer communication',
  Reporting: 'Management reporting',
  Documentation: 'Documentation',
  'Order processing': 'Order processing',
  Procurement: 'Procurement',
  Inventory: 'Inventory',
  'Finance-admin': 'Finance administration',
  'HR-admin': 'HR administration',
  Marketing: 'Marketing',
  'Customer support': 'Customer support',
  Scheduling: 'Scheduling & coordination',
  Operations: 'Operations coordination',
};

const EXPECTATION_AREAS: Record<string, string> = {
  'Improve sales': 'Sales follow-up',
  'Improve customer service': 'Customer support',
  'Analyse business information': 'Management reporting',
};

const KEYWORDS: [string, RegExp][] = [
  ['Data capture & entry', /data entry|typing|re-?enter|manual(ly)? (entry|enter|update)|copy(ing)? (data|from)/i],
  ['Management reporting', /\breports?\b|\bmis\b|dashboard|consolidat/i],
  ['Sales follow-up', /follow[- ]?ups?|\bleads?\b|enquir|inquir|quotation|pipeline|prospect/i],
  ['Customer communication', /customer (communication|updates?|queries)|client (communication|updates?)|reply|respond|call ?backs?/i],
  ['Documentation', /document|\bsops?\b|paperwork|manual records?/i],
  ['Order processing', /\borders?\b|dispatch|billing|invoicing/i],
  ['Procurement', /purchas|procure|vendor|supplier/i],
  ['Inventory', /inventory|\bstock\b|material (planning|tracking)/i],
  ['Finance administration', /collections?|payments?|reconcil|\baccounts\b|\bgst\b|ledger|receivable/i],
  ['HR administration', /attendance|payroll|recruit|hiring|\bleave\b/i],
  ['Marketing', /marketing|content|campaign|social media/i],
  ['Customer support', /support|complaints?|service requests?|tickets?/i],
  ['Scheduling & coordination', /schedul|appointment|coordinat|planning/i],
];

export function computeOpportunity(cfg: AssessmentConfig, answers: Answers): OpportunityProfile {
  const acc = new Map<string, { weight: number; sources: Set<string> }>();
  const add = (area: string, w: number, source: string) => {
    const e = acc.get(area) ?? { weight: 0, sources: new Set<string>() };
    e.weight += w;
    e.sources.add(source);
    acc.set(area, e);
  };
  for (const a of asArray(answers['Q3.6'])) if (AREAS[a]) add(AREAS[a], 1, 'Repetitive activity (Q3.6)');
  for (const a of asArray(answers['Q6.3'])) if (AREAS[a]) add(AREAS[a], 1.5, 'Repetitive work consuming effort (Q6.3)');
  for (const a of asArray(answers['Q6.6'])) if (EXPECTATION_AREAS[a]) add(EXPECTATION_AREAS[a], 1, 'Expectation of AI (Q6.6)');
  for (const id of ['Q6.1', 'Q6.2', 'Q6.5']) {
    const t = text(answers[id]);
    if (!t) continue;
    for (const [area, re] of KEYWORDS) if (re.test(t)) add(area, 1, `Respondent's own words (${id})`);
  }
  const areas: OpportunityArea[] = [...acc.entries()]
    .map(([label, e]) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      label,
      strength: (e.weight >= 3 ? 'strong' : e.weight >= 2 ? 'moderate' : 'emerging') as OpportunityArea['strength'],
      signalCount: e.sources.size,
      sources: [...e.sources].sort(),
      _w: e.weight,
    }))
    .sort((a, b) => b._w - a._w || a.label.localeCompare(b.label))
    .map(({ _w, ...rest }) => rest);

  const strong = areas.filter((a) => a.strength === 'strong').length;
  const moderate = areas.filter((a) => a.strength === 'moderate').length;
  const level: OpportunityProfile['level'] = strong >= 2 || strong + moderate >= 4 ? 'high' : strong + moderate >= 1 || areas.length >= 3 ? 'moderate' : 'limited';
  return {
    level,
    label: { high: 'High opportunity relevance', moderate: 'Moderate opportunity relevance', limited: 'Limited immediate opportunity signals' }[level],
    areas,
    priorityOutcomes: asArray(answers['Q6.4']),
    expectations: asArray(answers['Q6.6']),
  };
}

export function computeAdoptionIntent(answers: Answers): AdoptionIntent {
  const r = answers['Q6.7'];
  const rating = typeof r === 'number' ? r : null;
  const labels = ['', 'No current intent', 'Low intent', 'Moderate intent', 'Strong intent', 'Very strong intent'];
  return { rating, label: rating ? labels[rating] : 'Not stated' };
}
