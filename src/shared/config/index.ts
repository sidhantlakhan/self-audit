import type { AssessmentConfig, Question } from '../types.ts';
import { CONFIG_V1, ASSESSMENT_VERSION } from './v1.ts';

/**
 * Registry of every assessment configuration version ever released.
 * Completed assessments stay bound to the version they were taken on; old
 * versions must never be edited or removed — add a new file and register it.
 */
export const CONFIG_REGISTRY: Record<string, AssessmentConfig> = {
  v1: CONFIG_V1,
};

export const CURRENT_ASSESSMENT_VERSION = ASSESSMENT_VERSION;

export function getConfig(version: string = CURRENT_ASSESSMENT_VERSION): AssessmentConfig {
  const cfg = CONFIG_REGISTRY[version];
  if (!cfg) throw new Error(`Unknown assessment version: ${version}`);
  return cfg;
}

export function questionIndex(cfg: AssessmentConfig): Map<string, Question> {
  return new Map(cfg.questions.map((x) => [x.id, x]));
}

export function questionsForPhase(cfg: AssessmentConfig, phase: number): Question[] {
  return cfg.questions.filter((x) => x.phase === phase);
}

export { LISTS, SOURCE_CATEGORIES } from './lists.ts';
