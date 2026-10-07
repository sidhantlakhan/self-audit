import type { Analysis } from './schema.ts';

const VENDORS = [
  'ChatGPT', 'OpenAI', 'Claude', 'Anthropic', 'Gemini', 'Copilot', 'Perplexity', 'Zapier', 'n8n', 'HubSpot', 'Power BI', 'Tableau',
  'Zoho', 'Salesforce', 'SAP', 'Tally', 'Busy', 'Odoo', 'Notion', 'Airtable', 'Slack', 'Microsoft', 'Google', 'Midjourney', 'LangChain', 'Llama', 'Mistral',
];

const RULES: { name: string; re: RegExp }[] = [
  { name: 'roadmap/plan language', re: /\b(road ?map|implementation (plan|steps?)|step[- ]by[- ]step|action plan|rollout plan|blueprint)\b/i },
  { name: 'prescriptive language', re: /\b(you should|we recommend|i recommend|should (implement|adopt|deploy|buy|purchase|hire|install|automate|introduce|build)|need to (implement|adopt|deploy|hire|buy|install)|first,? (implement|set up|install|hire))\b/i },
  { name: 'outcome promise', re: /\b(guarantee[sd]?|roi|return on investment|will (increase|boost|grow|double|reduce|cut|save)\b|will deliver)\b/i },
  { name: 'hype', re: /\b(unlock|transform your|revolutioni[sz]e|supercharge|game[- ]chang|ai-powered future|cutting-edge|harness the power)\b/i },
];

export interface LintContext {
  /** Everything the respondent supplied (used to allow vendor names they themselves mentioned). */
  respondentText: string;
  /** Scores shown to the user — any "n/100" statement must match one of these. */
  knownScores: number[];
  turnoverLabel: string;
}

function allText(a: Analysis): string[] {
  return [
    a.executive_assessment, a.readiness_interpretation, a.founder_dependency_insight,
    ...a.dimension_insights.map((x) => x.insight),
    ...a.key_readiness_gaps.flatMap((x) => [x.title, x.evidence, x.why_it_matters]),
    ...a.ai_opportunity_areas.flatMap((x) => [x.area, x.rationale, x.readiness_note]),
    ...a.business_context_observations, ...a.consultation_focus_areas,
  ];
}

/** Returns a list of violations (empty = pass). */
export function lintAnalysis(a: Analysis, ctx: LintContext): string[] {
  const problems: string[] = [];
  const hay = ctx.respondentText.toLowerCase();
  for (const s of allText(a)) {
    for (const r of RULES) if (r.re.test(s)) problems.push(`${r.name}: "${s.slice(0, 80)}…"`);
    for (const v of VENDORS) {
      const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(s) && !hay.includes(v.toLowerCase())) problems.push(`vendor/tool name not supplied by respondent: ${v}`);
    }
    for (const m of s.matchAll(/(\d{1,3}(?:\.\d+)?)\s*(?:\/|out of)\s*100/gi)) {
      const n = Math.round(parseFloat(m[1]));
      if (!ctx.knownScores.includes(n)) problems.push(`score statement not matching supplied scores: ${m[0]}`);
    }
    for (const m of s.matchAll(/(?:₹|Rs\.?\s?|INR\s?)\s?[\d,.]+(?:\s?(?:crore|lakh|cr|k|m))?/gi)) {
      if (!ctx.turnoverLabel.includes(m[0].trim())) problems.push(`invented currency figure: ${m[0]}`);
    }
  }
  return [...new Set(problems)];
}
