import { z } from 'zod';

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('pglite:memory'),
  SESSION_SECRET: z.string().min(16).default('dev-session-secret-change-me-please'),
  RESUME_TOKEN_SECRET: z.string().min(16).default('dev-resume-secret-change-me-please'),
  ADMIN_AUTH_SECRET: z.string().min(16).default('dev-admin-secret-change-me-please'),
  BOOKING_WEBHOOK_SECRET: z.string().min(16).default('dev-booking-webhook-secret-change-me'),
  AI_PROVIDER: z.enum(['anthropic', 'mock']).default('mock'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('claude-sonnet-5-5'),
  AI_TIMEOUT_MS: z.coerce.number().int().default(60000),
  SUPPORT_EMAIL: z.string().default(''),
  BOOKING_URL: z.string().default('https://example.com/book-consultation'),
  EMAIL_PROVIDER: z.enum(['console', 'resend', 'none']).default('console'),
  EMAIL_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('diagnostic@example.com'),
  WHATSAPP_PROVIDER: z.enum(['none', 'console']).default('none'),
  ANALYTICS_PROVIDER: z.enum(['internal', 'none']).default('internal'),
  WORKER_ENABLED: z.string().default('true').transform((v) => v !== 'false' && v !== '0'),
  TRUST_PROXY: z.string().default('0').transform((v) => v === '1' || v === 'true'),
  SEED_ADMIN_EMAIL: z.string().default('admin@example.local'),
  SEED_ADMIN_PASSWORD: z.string().default(''),
});

export type Env = z.infer<typeof Schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Schema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${msg}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const weak = ['SESSION_SECRET', 'RESUME_TOKEN_SECRET', 'ADMIN_AUTH_SECRET', 'BOOKING_WEBHOOK_SECRET'].filter((k) => (source[k] ?? '').length < 32);
    if (weak.length) throw new Error(`Production requires strong secrets (>=32 chars): ${weak.join(', ')}`);
    if (env.AI_PROVIDER === 'mock') throw new Error('AI_PROVIDER=mock is not permitted in production');
    if (env.AI_PROVIDER === 'anthropic' && !env.AI_API_KEY) throw new Error('AI_API_KEY is required in production');
    if (env.DATABASE_URL.startsWith('pglite:')) throw new Error('Production requires a PostgreSQL DATABASE_URL');
    if (!env.APP_URL.startsWith('https://')) throw new Error('Production requires an https APP_URL');
  }
  return env;
}
