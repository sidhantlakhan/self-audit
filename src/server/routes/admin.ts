import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../lib/context.ts';
import { HttpError } from '../lib/context.ts';
import { ADMIN_COOKIE, adminAuth, parse } from './common.ts';
import { assessmentDetail, assessmentInternalId, audit, auditTrail, dashboard, listAssessments, login, logout } from '../services/admin.ts';
import { retryAnalysis } from '../services/analysis.ts';
import { getReportPdf, regenerateReport } from '../services/reports.ts';
import { recordBooked } from '../services/consultation.ts';

const range = { from: z.string().optional(), to: z.string().optional() };

export function adminRoutes(app: FastifyInstance, ctx: Ctx) {
  const gate = { preHandler: adminAuth(ctx) };
  const secure = ctx.env.NODE_ENV === 'production';

  app.post('/api/admin/login', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const b = parse(z.object({ email: z.string().max(200), password: z.string().min(1).max(200) }), req.body);
    const { token, session } = await login(ctx, b.email, b.password, req.ip, req.headers['user-agent'] ?? '');
    reply.setCookie(ADMIN_COOKIE, token, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 8 * 3600 });
    return { admin: { email: session.email, name: session.name }, csrf: session.csrf };
  });

  app.post('/api/admin/logout', gate, async (req, reply) => {
    await logout(ctx, req.admin!, req.ip);
    reply.clearCookie(ADMIN_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/admin/me', gate, async (req) => ({ admin: { email: req.admin!.email, name: req.admin!.name }, csrf: req.admin!.csrf }));

  app.get('/api/admin/dashboard', gate, async (req) => dashboard(ctx, parse(z.object(range), req.query)));

  app.get('/api/admin/assessments', gate, async (req) => {
    const q = parse(z.object({
      ...range, q: z.string().max(100).optional(), status: z.string().optional(), industry: z.string().optional(), source: z.string().optional(),
      band: z.string().optional(), consultation: z.string().optional(), opportunity: z.string().optional(), sort: z.string().optional(),
      dir: z.enum(['asc', 'desc']).optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional(),
    }), req.query);
    return listAssessments(ctx, q);
  });

  app.get<{ Params: { id: string } }>('/api/admin/assessments/:id', gate, async (req) => {
    const detail = await assessmentDetail(ctx, req.params.id);
    await audit(ctx, req.admin!, 'assessment.view', 'assessment', req.params.id, {}, req.ip);
    return detail;
  });

  app.get<{ Params: { id: string } }>('/api/admin/assessments/:id/report', gate, async (req, reply) => {
    const pdf = await getReportPdf(ctx, await assessmentInternalId(ctx, req.params.id));
    if (!pdf) throw new HttpError(404, 'No report has been generated for this assessment.');
    await audit(ctx, req.admin!, 'report.download', 'assessment', req.params.id, {}, req.ip);
    return reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `inline; filename="report-${req.params.id.slice(0, 8)}.pdf"`).header('Cache-Control', 'no-store').send(pdf);
  });

  app.post<{ Params: { id: string } }>('/api/admin/assessments/:id/retry-analysis', gate, async (req) => {
    const id = await assessmentInternalId(ctx, req.params.id);
    await retryAnalysis(ctx, id);
    await audit(ctx, req.admin!, 'analysis.retry', 'assessment', req.params.id, {}, req.ip);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/admin/assessments/:id/regenerate-report', gate, async (req) => {
    const id = await assessmentInternalId(ctx, req.params.id);
    await regenerateReport(ctx, id);
    await audit(ctx, req.admin!, 'report.regenerate', 'assessment', req.params.id, {}, req.ip);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/admin/assessments/:id/mark-booked', gate, async (req) => {
    const b = parse(z.object({ reference: z.string().max(120).optional() }), req.body ?? {});
    const id = await assessmentInternalId(ctx, req.params.id);
    const completed = await ctx.db.one('SELECT 1 FROM assessments WHERE id=$1 AND completed_at IS NOT NULL', [id]);
    if (!completed) throw new HttpError(409, 'Only completed assessments can have a consultation.');
    await recordBooked(ctx, id, { source: 'admin', reference: b.reference });
    await audit(ctx, req.admin!, 'consultation.mark_booked', 'assessment', req.params.id, { reference: b.reference ?? null }, req.ip);
    return { ok: true };
  });

  app.get('/api/admin/audit-log', gate, async () => ({ rows: await auditTrail(ctx) }));
}
