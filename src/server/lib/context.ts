import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../env.ts';
import type { Db } from '../db/client.ts';
import type { AiProvider } from '../ai/provider.ts';
import type { EmailProvider, WhatsAppProvider } from '../notify/providers.ts';

/** Everything a service needs. Passed explicitly — no module-level singletons. */
export interface Ctx {
  env: Env;
  db: Db;
  log: FastifyBaseLogger;
  ai: AiProvider;
  email: EmailProvider | null;
  whatsapp: WhatsAppProvider | null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error', public details?: unknown) {
    super(message);
  }
}
