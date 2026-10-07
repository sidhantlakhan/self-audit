import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);

export const DIMENSION_IDS = [
  'ownership_decision_making', 'processes_workflows', 'data_systems_technology', 'people_controls_governance', 'performance_business_control',
] as const;

export const AnalysisSchema = z.object({
  executive_assessment: text(900),
  readiness_interpretation: text(1100),
  dimension_insights: z.array(z.object({ dimension: z.enum(DIMENSION_IDS), insight: text(380) })).length(5),
  key_readiness_gaps: z.array(z.object({ title: text(120), evidence: text(400), why_it_matters: text(350) })).min(1).max(5),
  founder_dependency_insight: text(900),
  ai_opportunity_areas: z.array(z.object({ area: text(100), rationale: text(350), readiness_note: text(300) })).max(5),
  business_context_observations: z.array(text(320)).min(1).max(5),
  consultation_focus_areas: z.array(text(200)).min(1).max(5),
}).strict();

export type Analysis = z.infer<typeof AnalysisSchema>;
