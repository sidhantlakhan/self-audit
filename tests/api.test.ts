import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminCookie, fillAndComplete, makeApp, startAssessment, type TestApp } from './helpers.ts';
import { getConfig } from '../src/shared/config/index.ts';
import { signWebhook } from '../src/server/services/consultation.ts';
import { AiError, type AiProvider } from '../src/server/ai/provider.ts';
import { sampleAnswers } from '../src/server/dev/sample-answers.ts';

let t: TestApp;
beforeAll(async () => { t = await makeApp(); });
afterAll(async () => { await t.close(); });

describe('assessment lifecycle', () => {
  let a: Awaited<ReturnType<typeof startAssessment>>;

  it('creates an assessment with a public id and a secret token (never an internal id)', async () => {
    a = await startAssessment(t, { firstTouch: { utm_source: 'linkedin', utm_medium: 'organic', utm_campaign: 'webinar' }, landingUrl: 'https://x.test/?utm_source=linkedin', referrer: 'https://www.linkedin.com/' });
    expect(a.id).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    const row = await t.db.one<{ id: string; status: string }>('SELECT id, status FROM assessments WHERE public_id=$1', [a.id]);
    expect(row!.status).toBe('started');
    expect(a.id).not.toBe(row!.id);
    // token itself is never stored
    const stored = await t.db.query<{ token_hash: string }>('SELECT token_hash FROM assessment_tokens');
    expect(stored.every((s) => s.token_hash !== a.token)).toBe(true);
  });

  it('returns state with the public configuration (no scoring rules exposed)', async () => {
    const r = await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}`, headers: a.h });
    expect(r.statusCode).toBe(200);
    const s = r.json();
    expect(s.config.phases).toHaveLength(6);
    expect(s.config.questions).toHaveLength(55);
    expect(JSON.stringify(s)).not.toMatch(/"scoring"|"weight"|"aiRelevant"/);
  });

  it('autosaves answers and sets status in_progress; denormalises and normalises Phase 1 fields', async () => {
    const r = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: a.h,
      payload: { answers: { 'Q1.1': ' Asha Mehta ', 'Q1.3': '98765 43210', 'Q1.4': 'Asha@Example.COM', 'Q1.7': ['B2B', 'Services'] }, currentPhase: 1 } });
    expect(r.statusCode).toBe(200);
    const row = await t.db.one<any>('SELECT * FROM assessments WHERE public_id=$1', [a.id]);
    expect(row.status).toBe('in_progress');
    expect(row.respondent_name).toBe('Asha Mehta');
    expect(row.mobile).toBe('+919876543210');
    expect(row.email).toBe('asha@example.com');
    expect(row.business_model).toEqual(['B2B', 'Services']);
    expect(row.started_at).not.toBeNull();
  });

  it('is resumable: answers persist and are returned on the next load', async () => {
    const r = await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}`, headers: a.h });
    expect(r.json().answers['Q1.1']).toBe('Asha Mehta');
    expect(r.json().currentPhase).toBe(1);
  });

  it('rejects unknown questions, invalid options and out-of-range ratings (server-side validation)', async () => {
    const bad = async (answers: Record<string, unknown>) => t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: a.h, payload: { answers } });
    expect((await bad({ 'Q9.9': 'x' })).statusCode).toBe(422);
    expect((await bad({ 'Q1.5': 'Wizard' })).statusCode).toBe(422);
    expect((await bad({ 'Q2.1': 9 })).statusCode).toBe(422);
    expect((await bad({ 'Q2.2': ['Daily'] })).statusCode).toBe(422);
    expect((await bad({ 'Q1.4': 'not-an-email' })).statusCode).toBe(422);
    expect((await bad({ 'Q1.3': '12345' })).statusCode).toBe(422);
    expect((await bad({ 'Q2.3': ['None', 'Hiring'] })).statusCode).toBe(422);
    expect((await bad({ 'Q6.4': ['Increase revenue'] })).statusCode).toBe(200); // autosave accepts partial rankings…
  });

  it('blocks phase completion until required answers are valid, and names the failing questions', async () => {
    const r = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/phase-complete`, headers: a.h, payload: { phase: 1 } });
    expect(r.statusCode).toBe(422);
    expect(Object.keys(r.json().error.details)).toContain('Q1.2');
  });

  it('refuses to complete an incomplete assessment (missing data)', async () => {
    const r = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/complete`, headers: a.h });
    expect(r.statusCode).toBe(422);
    expect(r.json().error.code).toBe('incomplete');
    expect((await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}/result`, headers: a.h })).statusCode).toBe(409);
  });

  it('completes the assessment, freezes the snapshot, scores deterministically, queues analysis', async () => {
    await fillAndComplete(t, a, 'mid');
    const row = await t.db.one<any>('SELECT * FROM assessments WHERE public_id=$1', [a.id]);
    expect(row.status).toBe('analysis_pending');
    expect(row.completed_at).not.toBeNull();
    expect(row.assessment_version).toBe('v1');
    expect(row.scoring_version).toBe('v1');
    const snap = await t.db.one<any>('SELECT answers FROM assessment_snapshots WHERE assessment_id=$1', [row.id]);
    expect(snap.answers['Q1.1']).toBe('Kiran Shah');
    const dims = await t.db.query('SELECT * FROM assessment_dimension_scores WHERE assessment_id=$1', [row.id]);
    expect(dims).toHaveLength(5);
    const ind = await t.db.query<{ kind: string }>('SELECT kind FROM assessment_indicators WHERE assessment_id=$1 ORDER BY kind', [row.id]);
    expect(ind.map((i) => i.kind)).toEqual(['adoption_intent', 'founder_dependency', 'opportunity']);
  });

  it('is idempotent: completing twice does not duplicate records or jobs', async () => {
    const again = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/complete`, headers: a.h });
    expect(again.statusCode).toBe(200);
    expect(again.json().alreadyCompleted).toBe(true);
    const n = await t.db.one<{ c: number }>(`SELECT count(*)::int c FROM assessment_scores s JOIN assessments a ON a.id=s.assessment_id WHERE a.public_id=$1`, [a.id]);
    expect(n!.c).toBe(1);
    const jobs = await t.db.one<{ c: number }>(`SELECT count(*)::int c FROM jobs j JOIN assessments a ON a.id=j.assessment_id WHERE a.public_id=$1 AND j.type='analysis'`, [a.id]);
    expect(jobs!.c).toBe(1);
  });

  it('locks responses after completion', async () => {
    const r = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/responses`, headers: a.h, payload: { answers: { 'Q2.1': 5 } } });
    expect(r.statusCode).toBe(409);
  });

  it('shows the deterministic result immediately, before AI analysis runs', async () => {
    const r = await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}/result`, headers: a.h });
    expect(r.statusCode).toBe(200);
    const res = r.json();
    expect(res.analysis).toBeNull();
    expect(res.analysisStatus).toBe('pending');
    expect(res.score.dimensions).toHaveLength(5);
    expect(res.score.overall).toBeGreaterThan(0);
  });

  it('runs analysis then report through the job queue; statuses advance in order', async () => {
    await t.worker.drain();
    const row = await t.db.one<any>('SELECT * FROM assessments WHERE public_id=$1', [a.id]);
    expect(row.analysis_status).toBe('complete');
    expect(row.report_status).toBe('complete');
    expect(row.status).toBe('report_complete');
    expect(row.prompt_version).toBe('v1');
    expect(row.report_version).toBe('v1');
    const an = await t.db.one<any>('SELECT * FROM ai_analysis WHERE assessment_id=$1', [row.id]);
    expect(an.status).toBe('complete');
    expect(an.input_hash).toHaveLength(64);
    expect(an.model).toBe('mock-v1');
    // privacy: PII is not part of the AI input snapshot
    const snap = JSON.stringify(an.input_snapshot);
    expect(snap).not.toMatch(/Kiran|shahprecision|9876543210|Shah Precision/);
  });

  it('serves the AI interpretation with the result, without altering scores', async () => {
    const res = (await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}/result`, headers: a.h })).json();
    expect(res.analysis.key_readiness_gaps.length).toBeGreaterThan(0);
    expect(res.analysis.dimension_insights).toHaveLength(5);
    const stored = await t.db.one<any>(`SELECT overall_rounded FROM assessment_scores s JOIN assessments a ON a.id=s.assessment_id WHERE a.public_id=$1`, [a.id]);
    expect(res.score.overall).toBe(stored.overall_rounded);
  });

  it('serves a valid multi-page PDF report', async () => {
    const r = await t.app.inject({ method: 'GET', url: `/api/assessments/${a.id}/report`, headers: a.h });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    const buf = r.rawPayload;
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(5);
    expect(pages).toBeLessThanOrEqual(7);
  });

  it('report generation is idempotent', async () => {
    const { generateReport } = await import('../src/server/services/reports.ts');
    const row = await t.db.one<any>('SELECT id FROM assessments WHERE public_id=$1', [a.id]);
    await generateReport(t.ctx, row.id);
    const n = await t.db.one<{ c: number }>('SELECT count(*)::int c FROM reports WHERE assessment_id=$1', [row.id]);
    expect(n!.c).toBe(1);
  });

  it('consultation: click returns a prefilled booking URL; webhook marks booked; repeats are safe', async () => {
    const c = await t.app.inject({ method: 'POST', url: `/api/assessments/${a.id}/consultation`, headers: a.h, payload: {} });
    expect(c.statusCode).toBe(200);
    const url = new URL(c.json().bookingUrl);
    expect(url.searchParams.get('assessment_id')).toBe(a.id);
    expect(url.searchParams.get('email')).toBe('kiran@shahprecision.example');
    expect(url.searchParams.get('readiness_score')).toMatch(/^\d+$/);
    expect(url.searchParams.get('utm_source')).toBe('linkedin');
    let row = await t.db.one<any>('SELECT consultation_status FROM assessments WHERE public_id=$1', [a.id]);
    expect(row.consultation_status).toBe('clicked');

    const body = JSON.stringify({ assessment_id: a.id, booking_reference: 'BK-123', booked_at: '2026-10-10T10:00:00Z' });
    const bad = await t.app.inject({ method: 'POST', url: '/api/webhooks/booking', headers: { 'content-type': 'application/json', 'x-signature': 'sha256=deadbeef' }, payload: body });
    expect(bad.statusCode).toBe(401);
    const sig = signWebhook(t.ctx.env.BOOKING_WEBHOOK_SECRET, body);
    for (let i = 0; i < 2; i++) {
      const ok = await t.app.inject({ method: 'POST', url: '/api/webhooks/booking', headers: { 'content-type': 'application/json', 'x-signature': `sha256=${sig}` }, payload: body });
      expect(ok.statusCode).toBe(200);
    }
    row = await t.db.one<any>('SELECT * FROM assessments WHERE public_id=$1', [a.id]);
    expect(row.consultation_status).toBe('booked');
    expect(row.status).toBe('consultation_booked');
    expect(row.consultation_booked_at).not.toBeNull();
    const cons = await t.db.one<any>('SELECT * FROM consultations c JOIN assessments a ON a.id=c.assessment_id WHERE a.public_id=$1', [a.id]);
    expect(cons.booking_reference).toBe('BK-123');
    expect(cons.source).toBe('webhook');
    const ev = await t.db.one<{ c: number }>(`SELECT count(*)::int c FROM analytics_events WHERE event='consultation_booked'`);
    expect(ev!.c).toBe(1);
  });

  it('a late job completion never downgrades a booked status', async () => {
    const { advanceStatus } = await import('../src/server/services/assessments.ts');
    const row = await t.db.one<any>('SELECT id FROM assessments WHERE public_id=$1', [a.id]);
    await advanceStatus(t.db, row.id, 'analysis_complete');
    expect((await t.db.one<any>('SELECT status FROM assessments WHERE id=$1', [row.id]))!.status).toBe('consultation_booked');
  });

  it('retains attribution, with first touch preserved when a later touch arrives', async () => {
    await t.app.inject({ method: 'PATCH', url: `/api/assessments/${a.id}`, headers: a.h, payload: { latestTouch: { utm_source: 'meta', utm_campaign: 'retarget' } } });
    const at = await t.db.one<any>('SELECT * FROM attribution t JOIN assessments a ON a.id=t.assessment_id WHERE a.public_id=$1', [a.id]);
    expect(at.first_source).toBe('linkedin');
    expect(at.first_campaign).toBe('webinar');
    expect(at.first_category).toBe('linkedin');
    expect(at.latest_source).toBe('meta');
    expect(at.latest_category).toBe('meta');
    expect(at.landing_url).toContain('utm_source=linkedin');
  });

  it('tracks the funnel with source and without personal data', async () => {
    const ev = await t.db.query<any>(`SELECT event, props, source FROM analytics_events e JOIN assessments a ON a.id=e.assessment_id WHERE a.public_id=$1`, [a.id]);
    const names = new Set(ev.map((e) => e.event));
    for (const n of ['assessment_started', 'phase_started', 'question_answered', 'phase_completed', 'assessment_completed', 'analysis_started', 'analysis_completed', 'report_generated', 'consultation_clicked', 'consultation_booked']) expect(names.has(n), n).toBe(true);
    expect(ev.every((e) => e.source === 'linkedin')).toBe(true);
    expect(JSON.stringify(ev)).not.toMatch(/Kiran|@|9876/);
  });
});

describe('score determinism and the AI boundary', () => {
  it('identical answers produce identical scores across assessments', async () => {
    const x = await startAssessment(t); const y = await startAssessment(t);
    await fillAndComplete(t, x, 'mid'); await fillAndComplete(t, y, 'mid');
    const sx = (await t.app.inject({ method: 'GET', url: `/api/assessments/${x.id}/result`, headers: x.h })).json().score;
    const sy = (await t.app.inject({ method: 'GET', url: `/api/assessments/${y.id}/result`, headers: y.h })).json().score;
    expect(sx.overall).toBe(sy.overall);
    expect(sx.dimensions).toEqual(sy.dimensions);
  });

  it('different business context (same scoring inputs) never changes the score', async () => {
    const x = await startAssessment(t); const y = await startAssessment(t);
    await fillAndComplete(t, x, 'mid');
    await fillAndComplete(t, y, 'mid', { 'Q1.6': 'Healthcare & Wellness', 'Q1.8': 'Above ₹100 crore', 'Q1.9': '81–200', 'Q6.1': 'Patient scheduling is chaotic and costly.' });
    const sx = (await t.app.inject({ method: 'GET', url: `/api/assessments/${x.id}/result`, headers: x.h })).json().score;
    const sy = (await t.app.inject({ method: 'GET', url: `/api/assessments/${y.id}/result`, headers: y.h })).json().score;
    expect(sy.overall).toBe(sx.overall);
  });
});

describe('AI failure handling', () => {
  it('keeps the completed assessment and deterministic result when AI fails; admin can retry', async () => {
    let fail = true;
    const flaky: AiProvider = { name: 'flaky', model: 'flaky-1', async generate(req) { if (fail) throw new AiError('boom sk-secret-key-123456789012'); return JSON.stringify((await import('../src/server/ai/mock.ts')).mockAnalysis(req.input)); } };
    const f = await makeApp({ ai: flaky });
    try {
      const a = await startAssessment(f);
      await fillAndComplete(f, a, 'mid');
      await f.worker.drain(); // 3 attempts, zero backoff
      const row = await f.db.one<any>('SELECT * FROM assessments WHERE public_id=$1', [a.id]);
      expect(row.analysis_status).toBe('failed');
      expect(row.status).toBe('analysis_pending');
      const an = await f.db.one<any>('SELECT * FROM ai_analysis WHERE assessment_id=$1', [row.id]);
      expect(an.status).toBe('failed');
      expect(an.attempts).toBe(3);
      expect(an.error).not.toMatch(/sk-secret/); // keys never persisted
      const res = (await f.app.inject({ method: 'GET', url: `/api/assessments/${a.id}/result`, headers: a.h })).json();
      expect(res.score.overall).toBeGreaterThan(0); // deterministic result still available
      expect(res.analysis).toBeNull();
      expect(res.analysisStatus).toBe('failed');
      expect(JSON.stringify(res)).not.toMatch(/boom|sk-secret/);
      expect((await f.app.inject({ method: 'GET', url: `/api/assessments/${a.id}/report`, headers: a.h })).statusCode).toBe(409);

      fail = false;
      const admin = await adminCookie(f);
      const r = await f.app.inject({ method: 'POST', url: `/api/admin/assessments/${a.id}/retry-analysis`, headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf } });
      expect(r.statusCode).toBe(200);
      await f.worker.drain();
      const after = await f.db.one<any>('SELECT * FROM assessments WHERE public_id=$1', [a.id]);
      expect(after.analysis_status).toBe('complete');
      expect(after.report_status).toBe('complete');
    } finally { await f.close(); }
  });

  it('rejects model output that violates the guardrails (vendors, roadmaps, invented figures) and retries', async () => {
    let calls = 0;
    const naughty: AiProvider = { name: 'naughty', model: 'n-1', async generate(req) {
      calls++;
      const base = (await import('../src/server/ai/mock.ts')).mockAnalysis(req.input);
      if (calls <= 2) base.executive_assessment = 'You should implement ChatGPT and follow this roadmap to save ₹50 lakh.';
      return JSON.stringify(base);
    } };
    const f = await makeApp({ ai: naughty });
    try {
      const a = await startAssessment(f);
      await fillAndComplete(f, a, 'mid');
      await f.worker.drain();
      const row = await f.db.one<any>('SELECT analysis_status FROM assessments WHERE public_id=$1', [a.id]);
      expect(row.analysis_status).toBe('complete');
      expect(calls).toBe(3); // two rejected, then accepted on the second job attempt's repair loop
    } finally { await f.close(); }
  });
});

describe('resume', () => {
  it('lets a returning respondent request a link by email + mobile without revealing whether it matched', async () => {
    const x = await startAssessment(t);
    await t.app.inject({ method: 'POST', url: `/api/assessments/${x.id}/responses`, headers: x.h, payload: { answers: { 'Q1.3': '9812345678', 'Q1.4': 'resume@example.com' } } });
    const hit = await t.app.inject({ method: 'POST', url: '/api/resume', payload: { email: 'RESUME@example.com', mobile: '+91 98123 45678' } });
    const miss = await t.app.inject({ method: 'POST', url: '/api/resume', payload: { email: 'nobody@example.com', mobile: '9000000000' } });
    expect(hit.statusCode).toBe(200);
    expect(hit.json()).toEqual(miss.json());
    const outbox = await t.db.query<any>(`SELECT recipient, template, body FROM notifications WHERE recipient='resume@example.com'`);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].template).toBe('assessment_resume');
    expect(outbox[0].body).not.toMatch(/#t=[A-Za-z0-9_-]{20,}/); // token redacted from the outbox
  });
});

describe('validation helpers', () => {
  it('accepts a full valid assessment and exposes completion percentage', async () => {
    const x = await startAssessment(t);
    const cfg = getConfig();
    const answers = sampleAnswers('mid');
    const r = await t.app.inject({ method: 'POST', url: `/api/assessments/${x.id}/responses`, headers: x.h, payload: { answers: Object.fromEntries(cfg.questions.filter((q) => q.phase <= 3).map((q) => [q.id, answers[q.id]])) } });
    const pct = r.json().completionPercentage;
    expect(pct).toBeGreaterThan(30);
    expect(pct).toBeLessThan(100);
  });
});
