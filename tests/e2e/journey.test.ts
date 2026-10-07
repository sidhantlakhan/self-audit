// Full browser journey against the production build: landing → intake → six phases → review → submit → result → report → consultation.
// Requires `npm run build` first. Screenshots are written to test-results/screens for visual review.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright-core';
import { CONFIG_V1 } from '../../src/shared/config/v1.ts';
import { sampleAnswers } from '../../src/server/dev/sample-answers.ts';

const PORT = 3911;
const BASE = `http://localhost:${PORT}`;
const SHOTS = 'test-results/screens';
const ADMIN = { email: 'e2e-admin@example.test', password: 'e2e-password-123456' };
let server: ChildProcess; let browser: Browser; let dataDir: string;

const env = (dir: string) => ({
  ...process.env, NODE_ENV: 'development', DATABASE_URL: `pglite:${dir}`, AI_PROVIDER: 'mock', APP_URL: BASE, PORT: String(PORT),
  BOOKING_URL: 'https://booking.example.com/consult', ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, EMAIL_PROVIDER: 'none',
});

/** Admin API access for assertions (the same endpoints the admin UI uses). */
async function adminApi(path: string) {
  const login = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ADMIN) });
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  return (await fetch(`${BASE}${path}`, { headers: { cookie } })).json() as Promise<any>;
}

beforeAll(async () => {
  if (!existsSync('dist/server/index.js')) throw new Error('Run `npm run build` before the E2E tests.');
  mkdirSync(SHOTS, { recursive: true });
  dataDir = mkdtempSync(join(tmpdir(), 'aird-e2e-'));
  // Exercise the real production artefacts: built server bundle, built client, SSR bundle.
  execFileSync('npx', ['tsx', 'scripts/create-admin.ts'], { env: env(dataDir), stdio: 'ignore' });
  server = spawn('node', ['dist/server/index.js'], { env: env(dataDir), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
});
afterAll(async () => { await browser?.close(); server?.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 500)); if (dataDir) rmSync(dataDir, { recursive: true, force: true }); });

async function answerPhase(page: Page, phase: number, answers: Record<string, any>) {
  for (const q of CONFIG_V1.questions.filter((x) => x.phase === phase)) {
    const v = answers[q.id];
    const card = page.locator(`[id="card-${q.id}"]`);
    if (v === undefined || v === null) continue;
    switch (q.type) {
      case 'short_text': case 'phone': case 'email': case 'long_text': await card.locator(`[id="in-${q.id}"]`).fill(String(v)); break;
      case 'single_select':
        if (q.options!.length > 7) await card.locator('select').selectOption(v);
        else await card.getByRole('radio', { name: v, exact: true }).check({ force: true });
        break;
      case 'multi_select': for (const o of v as string[]) await card.getByRole('checkbox', { name: o, exact: true }).check({ force: true }); break;
      case 'rating': await card.getByRole('radio', { name: new RegExp(`^${v} of 5`) }).check({ force: true }); break;
      case 'ranking': for (const o of (v as string[])) await card.getByRole('button', { name: `＋ ${o}` }).click(); break;
    }
  }
}

describe('landing page', () => {
  it('is server-rendered with SEO metadata and the required CTA', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    expect(html).toContain('<title>AI Readiness Diagnostic');
    expect(html).toContain('rel="canonical" href="http://localhost:3911/"');
    expect(html).toContain('<h1>Is your business ready for AI?</h1>'); // server-rendered, not an empty shell
    expect(html).toContain('AI multiplies whatever it lands on.');
    expect(html).toContain('Take the 10-minute Scorecard');
    expect(html).toContain('Free · No card needed · Your data stays private.');
    expect(html).not.toMatch(/Self-Audit/i);
    expect((await fetch(`${BASE}/assessment`)).headers.get('x-robots-tag')).toContain('noindex');
    expect((await (await fetch(`${BASE}/assessment`)).text())).toContain('noindex');
    expect(await (await fetch(`${BASE}/robots.txt`)).text()).toContain('Disallow: /admin');
  });

  it.each([[375, 812], [390, 844], [768, 1024], [1024, 768], [1440, 900]])('renders without horizontal overflow at %ipx', async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('h1');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontFamily)).toContain('Mulish');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.hero')!).backgroundColor)).toBe('rgb(21, 18, 13)'); // stylesheet loaded
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // primary CTA is visible above the fold
    const cta = page.getByRole('link', { name: 'Take the 10-minute Scorecard' }).first();
    const box = (await page.locator('.hero').getByRole('link', { name: 'Take the 10-minute Scorecard' }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(h);
    await cta.waitFor();
    await page.screenshot({ path: `${SHOTS}/landing-${w}.png`, fullPage: w === 390 || w === 1440 });
    await ctx.close();
  });
});

describe('full respondent journey (mobile viewport)', () => {
  it('completes the diagnostic end to end and books a consultation', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('https://booking.example.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'booking' }));
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const answers = sampleAnswers('mid');

    // arrive via a campaign link; attribution must survive navigation across pages
    await page.goto(`${BASE}/?utm_source=linkedin&utm_medium=organic&utm_campaign=webinar`);
    await page.getByRole('link', { name: 'Take the 10-minute Scorecard' }).first().click();
    await page.waitForURL('**/assessment');
    await page.screenshot({ path: `${SHOTS}/intake-390.png` });

    // consent is required
    await page.getByRole('button', { name: 'Begin assessment' }).click();
    await page.getByText('Please agree to continue.').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('checkbox').check({ force: true });
    await page.getByRole('button', { name: 'Begin assessment' }).click();
    await page.waitForURL('**/phase/1');

    // validation: unanswered required questions are highlighted and block progress
    await page.getByRole('button', { name: /Continue to phase 2/ }).click();
    await page.getByText('Please answer the highlighted questions to continue.').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.qcard.has-error').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/phase1-errors-390.png`, fullPage: true });
    await page.fill('[id=\"in-Q1.4\"]', 'not-an-email');
    await page.fill('[id=\"in-Q1.3\"]', '123');

    await answerPhase(page, 1, answers);
    await page.waitForFunction(() => /Saved|Saving/.test(document.querySelector('.saved')?.textContent ?? ''));
    await page.screenshot({ path: `${SHOTS}/phase1-390.png`, fullPage: true });
    await page.getByRole('button', { name: /Continue to phase 2/ }).click();
    await page.waitForURL('**/phase/2');

    // resume: reload mid-assessment (answers and position persist)
    await answerPhase(page, 2, { ...answers, 'Q2.1': 4 });
    await page.waitForFunction(() => document.querySelector('.saved')?.textContent?.includes('Saved'));
    await page.reload();
    await page.waitForSelector('[id="card-Q2.1"]');
    expect(await page.locator('[id="card-Q2.1"]').getByRole('radio', { name: /^4 of 5/ }).isChecked()).toBe(true);
    await page.screenshot({ path: `${SHOTS}/phase2-390.png`, fullPage: true });
    await page.getByRole('button', { name: /Continue to phase 3/ }).click();

    for (const ph of [3, 4, 5, 6]) {
      await page.waitForURL(`**/phase/${ph}`);
      await answerPhase(page, ph, answers);
      if (ph === 6) await page.screenshot({ path: `${SHOTS}/phase6-390.png`, fullPage: true });
      await page.getByRole('button', { name: ph === 6 ? /Review answers/ : new RegExp(`Continue to phase ${ph + 1}`) }).click();
    }
    await page.waitForURL('**/review');
    await page.screenshot({ path: `${SHOTS}/review-390.png`, fullPage: true });
    expect(await page.getByText('required question').count()).toBe(0);

    await page.getByRole('button', { name: 'Complete Assessment' }).click();
    await page.waitForURL('**/result');
    await page.getByText(/out of 100/).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('heading', { name: /Dimension scores/ }).waitFor({ state: 'visible', timeout: 15000 });

    // AI interpretation arrives asynchronously, then the report
    await page.getByRole('heading', { name: /Key readiness gaps/ }).waitFor();
    await page.waitForSelector('.gap h3', { timeout: 60_000 });
    await page.getByRole('button', { name: /Download your report/ }).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/result-390.png`, fullPage: true });

    // the only commercial CTA is Book Consultation
    const html = await page.content();
    expect(html).not.toMatch(/Self-Audit|Get Implementation Plan|Talk to an AI Expert/i);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download your report/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.pdf$/);

    const [popup] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('link', { name: 'Book Consultation' }).first().click()]);
    expect(popup.url()).toContain('booking.example.com/consult');
    expect(popup.url()).toContain('assessment_id=');
    expect(popup.url()).toContain('utm_source=linkedin');
    await popup.close();
    expect(errors).toEqual([]);

    const list = await adminApi('/api/admin/assessments?q=Kiran');
    expect(list.total).toBe(1);
    const detail = await adminApi(`/api/admin/assessments/${list.rows[0].id}`);
    expect(detail.overview.consultationStatus).toBe('clicked');
    expect(detail.attribution.first_category).toBe('linkedin');
    expect(detail.attribution.first_campaign).toBe('webinar');
    expect(detail.analysis.status).toBe('complete');
    expect(detail.report.status).toBe('complete');
    await ctx.close();
  });

  it('shows a clear message and keeps answers when the network drops during autosave', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/assessment`);
    await page.getByRole('checkbox').check({ force: true });
    await page.getByRole('button', { name: 'Begin assessment' }).click();
    await page.waitForURL('**/phase/1');
    await page.waitForSelector('[id="in-Q1.1"]');
    await ctx.setOffline(true);
    await page.fill('[id=\"in-Q1.1\"]', 'Offline Person');
    await page.getByText('We couldn’t save your response. Please check your connection and try again.').waitFor({ state: 'visible', timeout: 15000 });
    await ctx.setOffline(false);
    // autosave recovers on its own once the connection returns (or via the Retry button)
    await page.getByRole('button', { name: 'Retry' }).first().click({ timeout: 1500 }).catch(() => undefined);
    await page.waitForFunction(() => /Saved/.test(document.querySelector('.saved')?.textContent ?? ''), null, { timeout: 20000 });
    expect((await adminApi('/api/admin/assessments?q=Offline')).total).toBe(1);
    await ctx.close();
  });

  it('shows the invalid-link message for a bad assessment link', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/a/not-a-real-id/phase/1#t=${'x'.repeat(43)}`);
    await page.getByText('This assessment link is no longer valid.').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('link', { name: 'Start a new assessment' }).waitFor({ state: 'visible', timeout: 15000 });
    await ctx.close();
  });
});

describe('admin UI', () => {
  it('protects the admin area, then shows dashboard, list and detail', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin`);
    await page.getByRole('heading', { name: 'Admin sign-in' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.fill('#a-email', 'e2e-admin@example.test');
    await page.fill('#a-pw', 'wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText('Incorrect email or password.').waitFor({ state: 'visible', timeout: 15000 });
    await page.fill('#a-pw', 'e2e-password-123456');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.kpi.primary').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/admin-dashboard-1440.png`, fullPage: true });
    await page.getByRole('link', { name: 'Assessments' }).click();
    await page.getByRole('heading', { name: 'Assessments' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('searchbox').fill('zzzz-nothing');
    await page.getByText('No assessments found').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('searchbox').fill('Offline');
    await page.getByRole('link', { name: 'Offline Person' }).click();
    await page.getByRole('tab', { name: 'Answers' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('tab', { name: 'Answers' }).click();
    await page.getByText('Phase 1 · Business Context').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/admin-detail-1440.png`, fullPage: true });
    // sign out returns to login
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Admin sign-in' }).waitFor({ state: 'visible', timeout: 15000 });
    await ctx.close();
  });
});
