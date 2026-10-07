import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Env } from './env.ts';
import type { Ctx } from './lib/context.ts';
import { HttpError } from './lib/context.ts';
import { adminRoutes } from './routes/admin.ts';
import { publicRoutes, DEFAULT_LIMITS, type RateLimits } from './routes/public.ts';
import { serveClient } from './routes/static.ts';

export interface BuildOptions { rateLimits?: Partial<RateLimits>; globalRateLimit?: number; logger?: boolean }

export async function buildApp(ctx: Ctx, opts: BuildOptions = {}): Promise<FastifyInstance> {
  const env: Env = ctx.env;
  const app = Fastify({
    logger: opts.logger === false ? false : {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      // Never log credentials; request bodies are never logged at all.
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      serializers: { req: (r) => ({ method: r.method, url: String(r.url).split('?')[0], ip: r.ip }) },
    },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 256 * 1024,
  });
  // The shared Ctx logger is the app logger (structured, redacted).
  (ctx as { log: typeof app.log }).log = app.log;

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'], connectSrc: ["'self'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], objectSrc: ["'none'"],
        ...(env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(rateLimit, { global: true, max: opts.globalRateLimit ?? 600, timeWindow: '1 minute' });

  // Keep the raw JSON text for webhook signature verification.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body as string;
    if (!body) return done(null, {});
    try { done(null, JSON.parse(body as string)); } catch { done(new HttpError(400, 'Malformed JSON.', 'bad_json')); }
  });

  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      reply.header('X-Robots-Tag', 'noindex, nofollow');
      if (!reply.getHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
    }
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    if (err.statusCode === 429) return reply.code(429).send({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' } });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: { code: 'bad_request', message: err.message } });
    req.log.error({ err: { message: err.message, stack: env.NODE_ENV === 'production' ? undefined : err.stack } }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
  });

  publicRoutes(app, ctx, { ...DEFAULT_LIMITS, ...opts.rateLimits });
  adminRoutes(app, ctx);

  app.all('/api/*', async (_req, reply) => reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } }));

  if (existsSync(resolve('dist/client/index.html'))) await serveClient(app, ctx);
  return app;
}
