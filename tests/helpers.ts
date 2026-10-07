import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../src/server/env.ts';
import { connect, migrate, type Db } from '../src/server/db/client.ts';
import { createContext } from '../src/server/bootstrap.ts';
import { buildApp, type BuildOptions } from '../src/server/app.ts';
import { syncConfigVersions } from '../src/server/services/config-sync.ts';
import { Worker } from '../src/server/jobs/worker.ts';
import type { Ctx } from '../src/server/lib/context.ts';
import type { AiProvider } from '../src/server/ai/provider.ts';
import { sampleAnswers, type Profile } from '../src/server/dev/sample-answers.ts';
import { getConfig } from '../src/shared/config/index.ts';
import { createAdmin } from '../src/server/services/admin.ts';

export interface TestApp { app: FastifyInstance; ctx: Ctx; db: Db; worker: Worker; close(): Promise<void> }

export async function makeApp(opts: BuildOptions & { ai?: AiProvider; env?: Record<string, string> } = {}): Promise<TestApp> {
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: 'pglite:memory', AI_PROVIDER: 'mock', ...opts.env } as NodeJS.ProcessEnv);
  const db = await connect('pglite:memory');
  await migrate(db);
  await syncConfigVersions(db);
  const ctx = createContext(env, db, { ai: opts.ai });
  const app = await buildApp(ctx, { rateLimits: { create: 1000, resume: 1000, save: 10000, events: 10000 }, globalRateLimit: 100000, logger: false, ...opts });
  await app.ready();
  const worker = new Worker(ctx, { backoffBaseSeconds: 0 });
  return { app, ctx, db, worker, close: async () => { await worker.stop(); await app.close(); await db.close(); } };
}

export async function startAssessment(t: TestApp, extra: Record<string, unknown> = {}) {
  const res = await t.app.inject({ method: 'POST', url: '/api/assessments', payload: { visitorId: 'v1', ...extra } });
  const { id, token } = res.json();
  return { id, token, h: { authorization: `Bearer ${token}` } };
}

/** Answers an entire assessment through the public API, phase by phase, exactly as the UI does. */
export async function fillAndComplete(t: TestApp, a: { id: string; h: Record<string, string> }, profile: Profile = 'mid', override: Record<string, unknown> = {}) {
  const cfg = getConfig();
  const answers = { ...sampleAnswers(profile), ...override };
  for (const ph of cfg.phases) {
    const patch = Object.fromEntries(cfg.questions.filter((q) => q.phase === ph.number && answers[q.id] !== undefined).map((q) => [q.id, answers[q.id]]));
    const r1 = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: a.h, payload: { answers: patch, currentPhase: ph.number } });
    if (r1.statusCode !== 200) throw new Error(`save phase ${ph.number}: ${r1.body}`);
    const r2 = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/phase-complete`, headers: a.h, payload: { phase: ph.number } });
    if (r2.statusCode !== 200) throw new Error(`phase-complete ${ph.number}: ${r2.body}`);
  }
  const done = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/complete`, headers: a.h });
  if (done.statusCode !== 200) throw new Error(`complete: ${done.body}`);
  return answers;
}

export async function adminCookie(t: TestApp, email = 'qa-admin@example.test', password = 'qa-password-123456') {
  await createAdmin(t.ctx, email, password, 'QA');
  const res = await t.app.inject({ method: 'POST', url: '/api/admin/login', payload: { email, password } });
  const cookie = res.cookies.find((c) => c.name === 'aird_admin')!;
  return { cookie: `aird_admin=${cookie.value}`, csrf: res.json().csrf as string, res };
}
