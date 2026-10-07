import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminCookie, fillAndComplete, makeApp, startAssessment, type TestApp } from './helpers.ts';
import { renderReportHtml } from '../src/server/report/render.ts';
import { mockAnalysis } from '../src/server/ai/mock.ts';

let t: TestApp;
beforeAll(async () => { t = await makeApp(); });
afterAll(async () => { await t.close(); });

describe('assessment data isolation', () => {
  it('never lets one respondent read or modify another’s assessment', async () => {
    const a = await startAssessment(t); const b = await startAssessment(t);
    const routes: [string, string, unknown?][] = [
      ['GET', ''], ['POST', '/responses', { answers: { 'Q1.1': 'Intruder' } }], ['POST', '/phase-complete', { phase: 1 }], ['POST', '/complete'],
      ['GET', '/result'], ['GET', '/report'], ['POST', '/consultation', {}], ['POST', '/analyze'], ['PATCH', '', { currentPhase: 2 }],
    ];
    const results = new Set<string>();
    for (const [method, suffix, payload] of routes) {
      const r = await t.app.inject({ method: method as 'GET', url: `/api/assessments/${b.id}${suffix}`, headers: a.h, payload: payload as object });
      expect(r.statusCode, `${method} ${suffix}`).toBe(401);
      results.add(r.body);
    }
    expect(results.size).toBe(1); // identical error for every probe
    expect((await t.db.one<any>('SELECT respondent_name FROM assessments WHERE public_id=$1', [b.id]))!.respondent_name).toBeNull();
  });

  it('treats unknown ids, missing tokens and malformed tokens identically (no enumeration)', async () => {
    const a = await startAssessment(t);
    const bodies = new Set<string>();
    for (const [id, h] of [['does-not-exist-123456789', a.h], [a.id, {}], [a.id, { authorization: 'Bearer nope' }], [a.id, { authorization: `Bearer ${a.token}x` }], [a.id, { authorization: a.token }]] as [string, Record<string, string>][]) {
      const r = await t.app.inject({ method: 'GET', url: `/api/assessments/${id}`, headers: h });
      expect(r.statusCode).toBe(401);
      expect(r.json().error.message).toBe('This assessment link is no longer valid.');
      bodies.add(r.body);
    }
    expect(bodies.size).toBe(1);
  });

  it('rejects expired tokens', async () => {
    const a = await startAssessment(t);
    await t.db.query(`UPDATE assessment_tokens SET expires_at = now() - interval '1 minute'`);
    expect((await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}`, headers: a.h })).statusCode).toBe(401);
  });

  it('slows repeated bad-token probing from one client', async () => {
    const a = await startAssessment(t);
    let last = 0;
    for (let i = 0; i < 40; i++) last = (await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}`, headers: { authorization: 'Bearer ' + 'x'.repeat(40) }, remoteAddress: '203.0.113.9' })).statusCode;
    expect(last).toBe(429);
  });
});

describe('admin authorisation', () => {
  it('blocks every admin route without a session', async () => {
    const routes: [string, string][] = [['GET', '/api/admin/me'], ['GET', '/api/admin/dashboard'], ['GET', '/api/admin/assessments'], ['GET', '/api/admin/assessments/abc'],
      ['GET', '/api/admin/assessments/abc/report'], ['POST', '/api/admin/assessments/abc/retry-analysis'], ['POST', '/api/admin/assessments/abc/regenerate-report'],
      ['POST', '/api/admin/assessments/abc/mark-booked'], ['GET', '/api/admin/audit-log'], ['POST', '/api/admin/logout']];
    for (const [method, url] of routes) expect((await t.app.inject({ method: method as 'GET', url })).statusCode, url).toBe(401);
  });

  it('rejects forged or tampered session cookies', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie: 'aird_admin=forged' } })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie: "aird_admin=' OR 1=1 --" } })).statusCode).toBe(401);
  });

  it('issues an HttpOnly, SameSite=Strict cookie and requires a CSRF token + same origin for writes', async () => {
    const adm = await adminCookie(t);
    const set = adm.res.cookies.find((c) => c.name === 'aird_admin')!;
    expect(set.httpOnly).toBe(true);
    expect(set.sameSite).toBe('Strict');
    const a = await startAssessment(t); await fillAndComplete(t, a, 'mid');
    const url = `/api/admin/assessments/${a.id}/mark-booked`;
    expect((await t.app.inject({ method: 'POST', url, headers: { cookie: adm.cookie }, payload: {} })).statusCode).toBe(403); // no csrf
    expect((await t.app.inject({ method: 'POST', url, headers: { cookie: adm.cookie, 'x-csrf-token': 'wrong' }, payload: {} })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url, headers: { cookie: adm.cookie, 'x-csrf-token': adm.csrf, origin: 'https://evil.example' }, payload: {} })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url, headers: { cookie: adm.cookie, 'x-csrf-token': adm.csrf }, payload: {} })).statusCode).toBe(200);
    expect((await t.db.one<any>('SELECT consultation_status FROM assessments WHERE public_id=$1', [a.id]))!.consultation_status).toBe('booked');
  });

  it('logout revokes the session', async () => {
    const adm = await adminCookie(t, 'logout@example.test');
    expect((await t.app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie: adm.cookie } })).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie: adm.cookie, 'x-csrf-token': adm.csrf } })).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie: adm.cookie } })).statusCode).toBe(401);
  });

  it('stores passwords only as salted scrypt hashes', async () => {
    await adminCookie(t, 'hash@example.test', 'a-very-long-password-1');
    const u = await t.db.one<any>(`SELECT password_hash FROM admin_users WHERE email='hash@example.test'`);
    expect(u.password_hash).toMatch(/^scrypt\$/);
    expect(u.password_hash).not.toContain('a-very-long-password-1');
  });

  it('locks an account after repeated failures, even for the correct password, and audits it', async () => {
    const { createAdmin } = await import('../src/server/services/admin.ts');
    await createAdmin(t.ctx, 'victim@example.test', 'correct-horse-battery');
    for (let i = 0; i < 5; i++) {
      const r = await t.app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'victim@example.test', password: 'wrong-' + i }, remoteAddress: `198.51.100.${i + 1}` });
      expect(r.statusCode).toBe(401);
    }
    const ok = await t.app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'victim@example.test', password: 'correct-horse-battery' }, remoteAddress: '198.51.100.99' });
    expect(ok.statusCode).toBe(429);
    const failures = await t.db.query(`SELECT 1 FROM audit_logs WHERE action='admin.login_failed' AND admin_email='victim@example.test'`);
    expect(failures.length).toBe(5);
  });

  it('gives the same response for unknown users and wrong passwords', async () => {
    const a = await t.app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'ghost@example.test', password: 'whatever-123' } });
    await adminCookie(t, 'real@example.test');
    const b = await t.app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'real@example.test', password: 'whatever-123' } });
    expect(a.statusCode).toBe(401);
    expect(a.body).toBe(b.body);
  });
});

describe('rate limiting', () => {
  it('limits assessment creation and resume requests per client', async () => {
    const r = await makeApp({ rateLimits: { create: 3, resume: 2 } });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) codes.push((await r.app.inject({ method: 'POST', url: '/api/assessments', payload: { consent: true } })).statusCode);
      expect(codes).toEqual([201, 201, 201, 429, 429]);
      const rc: number[] = [];
      for (let i = 0; i < 3; i++) rc.push((await r.app.inject({ method: 'POST', url: '/api/resume', payload: { email: 'a@b.co', mobile: '9812345678' } })).statusCode);
      expect(rc).toEqual([200, 200, 429]);
    } finally { await r.close(); }
  });
});

describe('input handling', () => {
  it('rejects malformed JSON, oversized bodies and bad shapes', async () => {
    const a = await startAssessment(t);
    expect((await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: { ...a.h, 'content-type': 'application/json' }, payload: '{bad' })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: { ...a.h, 'content-type': 'application/json' }, payload: JSON.stringify({ answers: { 'Q6.1': 'x'.repeat(400_000) } }) })).statusCode).toBe(413);
    expect((await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: a.h, payload: { answers: { 'Q6.1': 'x'.repeat(2000) } } })).statusCode).toBe(422); // over max length
    expect((await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/phase-complete`, headers: a.h, payload: { phase: 99 } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'POST', url: '/api/events', payload: { event: 'assessment_completed' } })).statusCode).toBe(400); // clients cannot forge server events
  });

  it('is not injectable through admin search/sort parameters', async () => {
    const adm = await adminCookie(t, 'inj@example.test');
    const r = await t.app.inject({ method: 'GET', url: `/api/admin/assessments?q=${encodeURIComponent("'; DROP TABLE assessments; --")}&sort=${encodeURIComponent('created_at; DROP TABLE x')}&status=${encodeURIComponent("' OR '1'='1")}`, headers: { cookie: adm.cookie } });
    expect(r.statusCode).toBe(200);
    expect(r.json().total).toBe(0);
    expect((await t.db.one<any>('SELECT count(*)::int c FROM assessments'))!.c).toBeGreaterThan(0);
  });

  it('escapes user-supplied text in the generated report', async () => {
    const analysis = mockAnalysis({ context: { industry: 'x', role: 'y' }, readiness: { overallScore: 40, band: 'Emerging', dimensions: [
      ['ownership_decision_making', 'Ownership & Decision Making'], ['processes_workflows', 'Processes & Workflows'], ['data_systems_technology', 'Data, Systems & Technology'], ['people_controls_governance', 'People, Controls & Governance'], ['performance_business_control', 'Performance & Business Control']].map(([id, label]) => ({ id, label, score: 40, weightPercent: 20 })), weakestAnswers: [] },
      indicators: { founderDependency: { level: 'high', signals: [] }, opportunity: { level: 'moderate', areas: [], priorityOutcomes: [], expectations: [] }, aiAdoptionIntent: { rating: 3, label: 'Moderate intent' } }, responses: [] });
    const html = renderReportHtml({ assessmentId: 'abc', generatedAt: new Date(), respondentName: '<script>alert(1)</script>', businessName: '"><img src=x onerror=alert(1)>', role: 'Founder', industry: 'x', businessModel: ['B2B'], turnoverRange: '₹3–10 crore', teamSize: '8–20', yearsInOperation: '5–10 years', completedAt: new Date(), analysis,
      score: { scoringVersion: 'v1', assessmentVersion: 'v1', overall: 40, overallRounded: 40, band: { id: 'emerging', label: 'Emerging', summary: '' }, dimensions: [], founderDependency: { index: 60, level: 'high', label: 'High', signals: [] }, opportunity: { level: 'moderate', label: 'Moderate', areas: [], priorityOutcomes: [], expectations: [] }, adoptionIntent: { rating: 3, label: 'x' }, profile: { key: 'x', label: 'x' } },
      bandDefs: [], bookingUrl: 'https://example.com/?a=1&b=2' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('transport headers', () => {
  it('sets a strict CSP, no-store and noindex on API responses', async () => {
    const r = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(r.headers['content-security-policy']).toContain("default-src 'self'");
    expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toContain('noindex');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
  it('never leaks internal errors', async () => {
    const r = await t.app.inject({ method: 'GET', url: '/api/nope' });
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toMatch(/stack|node_modules/);
  });
});

describe('production environment guard', () => {
  it('refuses weak configuration in production', async () => {
    const { loadEnv } = await import('../src/server/env.ts');
    expect(() => loadEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/strong secrets/);
    const strong = 'x'.repeat(40);
    const base = { NODE_ENV: 'production', SESSION_SECRET: strong, RESUME_TOKEN_SECRET: strong, ADMIN_AUTH_SECRET: strong, BOOKING_WEBHOOK_SECRET: strong, APP_URL: 'https://diag.example.com', DATABASE_URL: 'postgres://u:p@h/db' };
    expect(() => loadEnv({ ...base, AI_PROVIDER: 'mock' } as NodeJS.ProcessEnv)).toThrow(/mock/);
    expect(() => loadEnv({ ...base, AI_PROVIDER: 'anthropic' } as NodeJS.ProcessEnv)).toThrow(/AI_API_KEY/);
    expect(loadEnv({ ...base, AI_PROVIDER: 'anthropic', AI_API_KEY: 'k' } as NodeJS.ProcessEnv).NODE_ENV).toBe('production');
  });
});
