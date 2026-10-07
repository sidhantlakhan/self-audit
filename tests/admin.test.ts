import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminCookie, fillAndComplete, makeApp, startAssessment, type TestApp } from './helpers.ts';

let t: TestApp;
let cookie: string;
let ids: Record<string, string> = {};
beforeAll(async () => {
  t = await makeApp();
  cookie = (await adminCookie(t)).cookie;
  const mk = async (key: string, touch: Record<string, string>, profile: 'weak' | 'mid' | 'strong', complete = true, override: Record<string, unknown> = {}) => {
    const a = await startAssessment(t, { firstTouch: touch });
    if (complete) await fillAndComplete(t, a, profile, override);
    else await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: a.h, payload: { answers: { 'Q1.1': 'Partial Person', 'Q1.2': 'Partial Co' } } });
    ids[key] = a.id;
    return a;
  };
  const w = await mk('weakWebinar', { utm_source: 'webinar', utm_campaign: 'oct-webinar' }, 'weak', true, { 'Q1.1': 'Weak Webinar', 'Q1.2': 'Alpha Foods' });
  await mk('midLinkedin', { utm_source: 'linkedin', utm_campaign: 'oct-li' }, 'mid', true, { 'Q1.1': 'Mid Linkedin', 'Q1.2': 'Beta Textiles', 'Q1.6': 'Manufacturing — Textiles & Apparel' });
  await mk('strongMeta', { utm_source: 'facebook', utm_medium: 'paid' }, 'strong', true, { 'Q1.1': 'Strong Meta', 'Q1.2': 'Gamma Retail' });
  await mk('partial', {}, 'mid', false);
  await t.worker.drain();
  const { recordClick, recordBooked } = await import('../src/server/services/consultation.ts');
  const wid = (await t.db.one<any>('SELECT id FROM assessments WHERE public_id=$1', [w.id]))!.id;
  await recordBooked(t.ctx, wid, { source: 'webhook', reference: 'BK-1' });
  void recordClick;
});
afterAll(async () => { await t.close(); });

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { cookie } });

describe('admin dashboard', () => {
  it('reports funnel counts and consultation conversion (booked ÷ completed)', async () => {
    const d = (await get('/api/admin/dashboard')).json();
    expect(d.metrics.totalAssessments).toBe(4);
    expect(d.metrics.started).toBe(4);
    expect(d.metrics.completed).toBe(3);
    expect(d.metrics.completionRate).toBe(75);
    expect(d.metrics.consultationBookings).toBe(1);
    expect(d.metrics.consultationConversion).toBeCloseTo(33.3, 1);
    expect(d.metrics.averageScore).toBeGreaterThan(0);
    expect(d.funnel.map((f: any) => f.step)).toContain('Consultation booked');
  });
  it('breaks performance down by source and campaign', async () => {
    const d = (await get('/api/admin/dashboard')).json();
    const webinar = d.sources.find((s: any) => s.source === 'webinar');
    expect(webinar).toMatchObject({ assessments: 1, completed: 1, booked: 1, conversion: 100 });
    expect(d.sources.find((s: any) => s.source === 'meta').assessments).toBe(1); // utm_source=facebook → meta
    expect(d.sources.find((s: any) => s.source === 'direct').assessments).toBe(1);
    expect(d.campaigns.find((c: any) => c.campaign === 'oct-li').completed).toBe(1);
  });
  it('shows opportunity distribution', async () => {
    const d = (await get('/api/admin/dashboard')).json();
    expect(d.opportunity.levels.reduce((a: number, l: any) => a + l.count, 0)).toBe(3);
    expect(d.opportunity.areas.length).toBeGreaterThan(0);
  });
  it('filters by date range', async () => {
    expect((await get('/api/admin/dashboard?from=2000-01-01&to=2000-01-02')).json().metrics.totalAssessments).toBe(0);
    const today = new Date().toISOString().slice(0, 10);
    expect((await get(`/api/admin/dashboard?from=${today}&to=${today}`)).json().metrics.totalAssessments).toBe(4);
  });
});

describe('admin assessment list', () => {
  it('lists all columns required by the brief', async () => {
    const r = (await get('/api/admin/assessments')).json();
    expect(r.total).toBe(4);
    const row = r.rows.find((x: any) => x.name === 'Mid Linkedin');
    for (const k of ['name', 'business', 'industry', 'turnover', 'teamSize', 'mobile', 'email', 'source', 'status', 'score', 'opportunity', 'completedAt', 'consultation']) expect(row, k).toHaveProperty(k);
    expect(row.business).toBe('Beta Textiles');
    expect(row.source).toBe('linkedin');
  });
  it('searches, filters, sorts and paginates', async () => {
    expect((await get('/api/admin/assessments?q=beta')).json().total).toBe(1);
    expect((await get('/api/admin/assessments?q=shahprecision')).json().total).toBe(3); // email search (sample data)
    expect((await get('/api/admin/assessments?source=webinar')).json().total).toBe(1);
    expect((await get('/api/admin/assessments?consultation=booked')).json().total).toBe(1);
    expect((await get('/api/admin/assessments?band=foundation')).json().total).toBe(1);
    expect((await get('/api/admin/assessments?status=in_progress')).json().total).toBe(1);
    const asc = (await get('/api/admin/assessments?sort=score&dir=asc')).json().rows.filter((x: any) => x.score !== null).map((x: any) => x.score);
    expect(asc).toEqual([...asc].sort((a: number, b: number) => a - b));
    const p1 = (await get('/api/admin/assessments?pageSize=2&page=1')).json();
    const p2 = (await get('/api/admin/assessments?pageSize=2&page=2')).json();
    expect(p1.rows).toHaveLength(2); expect(p2.rows).toHaveLength(2);
    expect(new Set([...p1.rows, ...p2.rows].map((x: any) => x.id)).size).toBe(4);
  });
  it('returns an empty list (not an error) when nothing matches', async () => {
    const r = (await get('/api/admin/assessments?q=zzzznomatch')).json();
    expect(r.total).toBe(0); expect(r.rows).toEqual([]);
  });
});

describe('admin assessment detail', () => {
  it('exposes raw answers for all six phases, scores, AI analysis, report and consultation', async () => {
    const d = (await get(`/api/admin/assessments/${ids.weakWebinar}`)).json();
    expect(d.phases).toHaveLength(6);
    expect(d.phases[1].answers.map((a: any) => a.id)).toEqual(['Q2.1', 'Q2.2', 'Q2.3', 'Q2.4', 'Q2.5', 'Q2.6', 'Q2.7', 'Q2.8']);
    expect(d.phases[0].answers.find((a: any) => a.id === 'Q1.2').answer).toBe('Alpha Foods');
    expect(d.score.dimensions).toHaveLength(5);
    expect(d.score.founderDependency.level).toBe('very_high');
    expect(d.analysis.status).toBe('complete');
    expect(d.analysis.output.consultation_focus_areas.length).toBeGreaterThan(0);
    expect(d.report.status).toBe('complete');
    expect(d.consultation.status).toBe('booked');
    expect(d.attribution.first_category).toBe('webinar');
    expect(d.overview.versions).toEqual({ assessment: 'v1', scoring: 'v1', prompt: 'v1', report: 'v1' });
    expect(JSON.stringify(d)).not.toMatch(/"id":"[0-9a-f-]{36}"/); // internal UUIDs are not exposed
  });
  it('records views and actions in the audit log', async () => {
    const log = (await get('/api/admin/audit-log')).json().rows;
    expect(log.some((r: any) => r.action === 'assessment.view')).toBe(true);
    expect(log.some((r: any) => r.action === 'admin.login')).toBe(true);
  });
  it('downloads the report PDF for admins', async () => {
    const r = await t.app.inject({ method: 'GET', url: `/api/admin/assessments/${ids.weakWebinar}/report`, headers: { cookie } });
    expect(r.statusCode).toBe(200);
    expect(r.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });
  it('returns 404 for unknown assessments', async () => {
    expect((await get('/api/admin/assessments/unknown-id')).statusCode).toBe(404);
  });
});
