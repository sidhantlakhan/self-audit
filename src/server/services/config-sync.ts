import type { Db } from '../db/client.ts';
import { CONFIG_REGISTRY } from '../../shared/config/index.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT_V1 } from '../ai/prompts.ts';
import { REPORT_VERSION } from '../report/render.ts';
import { sha256, stableStringify } from '../lib/crypto.ts';

/**
 * Persists every configuration version in code to the database (immutable once written) so that historical
 * assessments, scores, prompts and reports can always be traced to the exact configuration that produced them.
 * Throws if a released version's content has changed — released versions must never be edited.
 */
export async function syncConfigVersions(db: Db): Promise<void> {
  const items: { kind: string; version: string; payload: unknown }[] = [];
  for (const [version, cfg] of Object.entries(CONFIG_REGISTRY)) {
    items.push({ kind: 'assessment', version, payload: { phases: cfg.phases, questions: cfg.questions } });
    items.push({ kind: 'scoring', version: cfg.scoringVersion, payload: { dimensions: cfg.dimensions, bands: cfg.bands, rules: cfg.questions.filter((q) => q.scored).map((q) => ({ id: q.id, dimension: q.dimension, weight: q.weight, scoring: q.scoring })) } });
  }
  items.push({ kind: 'prompt', version: PROMPT_VERSION, payload: { system: SYSTEM_PROMPT_V1 } });
  items.push({ kind: 'report', version: REPORT_VERSION, payload: { sections: 7 } });
  for (const it of items) {
    const hash = sha256(stableStringify(it.payload));
    const row = await db.one<{ content_hash: string }>('SELECT content_hash FROM config_versions WHERE kind=$1 AND version=$2', [it.kind, it.version]);
    if (!row) {
      await db.query('INSERT INTO config_versions (kind, version, content_hash, payload) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [it.kind, it.version, hash, JSON.stringify(it.payload)]);
    } else if (row.content_hash !== hash && process.env.NODE_ENV === 'production') {
      throw new Error(`Released ${it.kind} configuration "${it.version}" has been modified. Create a new version instead of editing a released one.`);
    }
  }
}
