// Shared types — used by the server, the scoring engine and the client.

export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'phone'
  | 'email'
  | 'single_select'
  | 'multi_select'
  | 'rating'
  | 'numeric'
  | 'ranking';

export type DimensionId =
  | 'ownership_decision_making'
  | 'processes_workflows'
  | 'data_systems_technology'
  | 'people_controls_governance'
  | 'performance_business_control';

export type Answer = string | number | string[] | null;
export type Answers = Record<string, Answer>;

export interface QuestionOption {
  value: string;
  label?: string;
}

/**
 * How a question converts to a 0–100 score.
 *  - rating:   1..5 → 0,25,50,75,100 (fixed)
 *  - map:      single-select value → score
 *  - multi:    sum of per-option points, divided by `max`, clamped to 0..100
 *  - inverse_count: 100 × (1 − selections / total); `ignore` options are not counted
 *  - numeric:  linear between `min` (0) and `max` (100); `invert` flips it
 */
export type ScoringRule =
  | { kind: 'rating' }
  | { kind: 'map'; map: Record<string, number> }
  | { kind: 'multi'; points: Record<string, number>; max: number }
  | { kind: 'inverse_count'; total: number; ignore: string[] } // fewer selections = higher score
  | { kind: 'numeric'; min: number; max: number; invert?: boolean };

export interface QuestionValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface DisplayCondition {
  questionId: string;
  includes?: string; // multi-select contains / single-select equals
  equals?: string | number;
}

export interface Question {
  id: string;
  phase: number;
  dimension: DimensionId | 'context';
  type: QuestionType;
  label: string;
  description?: string;
  helpText?: string;
  required: boolean;
  options?: QuestionOption[];
  /** Options that, when chosen, clear every other choice (e.g. "None"). */
  exclusiveOptions?: string[];
  /** Config key from `lists` (industries, turnover, …) — expands to options at load time. */
  optionsFrom?: string;
  /** Ranking only: how many items the respondent must rank (top-N). */
  rankCount?: number;
  /** Rating only: end-point labels. */
  scale?: { low: string; high: string };
  validation?: QuestionValidation;
  scoring?: ScoringRule;
  weight: number;
  scored: boolean;
  aiRelevant: boolean;
  opportunityRelevant: boolean;
  /** Voice dictation is offered (long_text only). */
  voice?: boolean;
  /** Maps this answer onto a column of the assessments table. */
  field?: 'respondent_name' | 'business_name' | 'mobile' | 'email' | 'role' | 'industry' | 'business_model' | 'turnover_range' | 'team_size' | 'years_in_operation';
  displayIf?: DisplayCondition;
  version: string;
}

export interface PhaseDef {
  number: number;
  title: string;
  dimension: DimensionId | null;
  intro: string;
}

export interface DimensionDef {
  id: DimensionId;
  label: string;
  short: string;
  weight: number; // fraction, all dimensions sum to 1
  description: string;
}

export interface BandDef {
  id: string;
  label: string;
  min: number;
  max: number;
  summary: string;
}

export interface AssessmentConfig {
  version: string; // assessment_version
  scoringVersion: string;
  phases: PhaseDef[];
  dimensions: DimensionDef[];
  bands: BandDef[];
  questions: Question[];
}

// ── Scoring output ──────────────────────────────────────────────────────

export interface QuestionScore {
  questionId: string;
  dimension: DimensionId;
  score: number; // 0..100 full precision
  weight: number;
}

export interface DimensionScore {
  dimension: DimensionId;
  label: string;
  score: number; // full precision
  weight: number;
  answered: number;
  questions: QuestionScore[];
}

export interface FounderDependency {
  /** 0..100, higher = more dependent on the founder. Internal; shown as a profile. */
  index: number;
  level: 'low' | 'moderate' | 'high' | 'very_high';
  label: string;
  signals: string[];
}

export interface OpportunityArea {
  id: string;
  label: string;
  strength: 'strong' | 'moderate' | 'emerging';
  signalCount: number;
  sources: string[];
}

export interface OpportunityProfile {
  level: 'high' | 'moderate' | 'limited';
  label: string;
  areas: OpportunityArea[];
  priorityOutcomes: string[]; // top ranked business outcomes (Q6.4)
  expectations: string[]; // Q6.6
}

export interface AdoptionIntent {
  rating: number | null; // 1..5
  label: string;
}

export interface ScoreResult {
  scoringVersion: string;
  assessmentVersion: string;
  overall: number; // full precision
  overallRounded: number;
  band: { id: string; label: string; summary: string };
  dimensions: DimensionScore[];
  founderDependency: FounderDependency;
  opportunity: OpportunityProfile;
  adoptionIntent: AdoptionIntent;
  /** Readiness × opportunity quadrant — kept as two separate facts, never one score. */
  profile: { key: string; label: string };
}
