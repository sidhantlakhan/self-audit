import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Ctx } from '../lib/context.ts';
import { HttpError } from '../lib/context.ts';
import { authenticate, type AssessmentRow } from '../services/assessments.ts';
import { getSession, type AdminSession } from '../services/admin.ts';
import { safeEqual } from '../lib/crypto.ts';
import { z } from 'zod';

declare module 'fastify' {
  interface FastifyRequest {
    assessment?: AssessmentRow;
    admin?: AdminSession;
    rawBody?: string;
  }
}

export const ADMIN_COOKIE = 'aird_admin';

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'Invalid request.', 'bad_request', r.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

// Failed token attempts per client — slows down enumeration of public ids / tokens.
const failures = new Map<string, { n: number; reset: number }>();
const FAIL_LIMIT = 30;
const FAIL_WINDOW_MS = 10 * 60_000;

/** Authorises access to exactly one assessment: the bearer token must belong to the public id in the URL. */
export function assessmentAuth(ctx: Ctx) {
  return async (req: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
    const now = Date.now();
    const f = failures.get(req.ip);
    if (f && f.reset > now && f.n >= FAIL_LIMIT) throw new HttpError(429, 'Too many attempts. Please try again later.', 'rate_limited');
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const a = await authenticate(ctx, req.params.id, token);
    if (!a) {
      const cur = f && f.reset > now ? f : { n: 0, reset: now + FAIL_WINDOW_MS };
      cur.n++;
      failures.set(req.ip, cur);
      if (failures.size > 5000) for (const [k, v] of failures) if (v.reset < now) failures.delete(k);
      throw new HttpError(401, 'This assessment link is no longer valid.', 'invalid_link');
    }
    req.assessment = a;
  };
}

/** Admin gate: valid session cookie, plus CSRF token and same-origin check on every state-changing request. */
export function adminAuth(ctx: Ctx) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const s = await getSession(ctx, req.cookies[ADMIN_COOKIE]);
    if (!s) throw new HttpError(401, 'Please sign in.', 'unauthenticated');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const given = req.headers['x-csrf-token'];
      if (typeof given !== 'string' || !safeEqual(given, s.csrf)) throw new HttpError(403, 'Invalid request token.', 'csrf');
      const origin = req.headers.origin;
      if (origin) {
        const allowed = new Set([new URL(ctx.env.APP_URL).origin, `${req.protocol}://${req.headers.host}`]);
        if (!allowed.has(origin)) throw new HttpError(403, 'Cross-origin request blocked.', 'csrf');
      }
    }
    req.admin = s;
  };
}
