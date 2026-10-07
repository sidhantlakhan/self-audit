import type { Env } from './env.ts';
import type { Db } from './db/client.ts';
import type { Ctx } from './lib/context.ts';
import { createAiProvider, type AiProvider } from './ai/provider.ts';
import { createEmailProvider, createWhatsAppProvider } from './notify/providers.ts';

/** Builds the dependency context. Providers can be overridden (tests inject fakes). */
export function createContext(env: Env, db: Db, overrides: Partial<{ ai: AiProvider }> = {}): Ctx {
  return {
    env,
    db,
    // Replaced by the Fastify logger in buildApp(); a console fallback keeps scripts/tests working.
    log: console as unknown as Ctx['log'],
    ai: overrides.ai ?? createAiProvider(env),
    email: createEmailProvider(env),
    whatsapp: createWhatsAppProvider(env),
  };
}
