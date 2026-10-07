// Development seed data. Refuses to run in production.
import { loadEnv } from '../src/server/env.ts';
import { connect, migrate } from '../src/server/db/client.ts';
import { createContext } from '../src/server/bootstrap.ts';
import { syncConfigVersions } from '../src/server/services/config-sync.ts';
import { createAdmin } from '../src/server/services/admin.ts';
import { authenticate, completeAssessment, completePhase, createAssessment, resumeLink, saveResponses } from '../src/server/services/assessments.ts';
import { recordBooked, recordClick } from '../src/server/services/consultation.ts';
import { Worker } from '../src/server/jobs/worker.ts';
import { closePdfBrowser } from '../src/server/report/pdf.ts';
import { sampleAnswers, type Profile } from '../src/server/dev/sample-answers.ts';
import { getConfig } from '../src/shared/config/index.ts';
import type { Answers } from '../src/shared/types.ts';

const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('Seeding is for development only.');
const db = await connect(env.DATABASE_URL);
await migrate(db);
await syncConfigVersions(db);
const ctx = createContext(env, db);
const cfg = getConfig();

const adminEmail = env.SEED_ADMIN_EMAIL;
const adminPassword = env.SEED_ADMIN_PASSWORD || 'dev-admin-pass-1234';
await createAdmin(ctx, adminEmail, adminPassword, 'Development Admin');

async function make(name: string, business: string, email: string, mobile: string, profile: Profile, touch: Record<string, string>, opts: { complete: boolean; upToPhase?: number; book?: 'booked' | 'clicked'; override?: Record<string, unknown> }) {
  const { publicId, token } = await createAssessment(ctx, { visitorId: `seed-${business}`, firstTouch: touch, latestTouch: touch, landingUrl: 'http://localhost:5173/', userAgent: 'Mozilla/5.0 (Macintosh)' });
  const row = (await authenticate(ctx, publicId, token))!;
  const answers: Answers = { ...sampleAnswers(profile), 'Q1.1': name, 'Q1.2': business, 'Q1.4': email, 'Q1.3': mobile, ...opts.override };
  const last = opts.complete ? cfg.phases.length : opts.upToPhase ?? 1;
  for (const ph of cfg.phases.filter((p) => p.number <= last)) {
    const patch = Object.fromEntries(cfg.questions.filter((q) => q.phase === ph.number).map((q) => [q.id, answers[q.id]]));
    await saveResponses(ctx, row, patch, ph.number);
    if (ph.number < last || opts.complete) await completePhase(ctx, row, ph.number);
  }
  if (opts.complete) await completeAssessment(ctx, row);
  return { publicId, token, row, book: opts.book };
}

const seeded = [
  await make('Kiran Shah', 'Shah Precision Components', 'kiran@shahprecision.example', '+919876543210', 'weak', { utm_source: 'webinar', utm_medium: 'event', utm_campaign: 'ai-ready-msme' }, { complete: true, book: 'booked' }),
  await make('Meera Patel', 'Patel Agro Foods', 'meera@patelagro.example', '+919812300001', 'mid', { utm_source: 'linkedin', utm_medium: 'organic', utm_campaign: 'founder-series' }, { complete: true, book: 'clicked', override: { 'Q1.6': 'Manufacturing — Food & Agro Processing', 'Q1.8': '₹10–25 crore', 'Q1.9': '51–80' } }),
  await make('Arjun Desai', 'Desai Distributors', 'arjun@desaidist.example', '+919812300002', 'mid', { source: 'referral', ref: 'partner-ca' }, { complete: true, override: { 'Q1.6': 'Trading & Distribution', 'Q1.8': '₹3–10 crore' } }),
  await make('Neha Joshi', 'Joshi Wellness Studio', 'neha@joshiwellness.example', '+919812300003', 'strong', { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'oct-retarget' }, { complete: true, override: { 'Q1.6': 'Healthcare & Wellness', 'Q1.8': '₹1–3 crore', 'Q1.9': '8–20' } }),
  await make('Rohan Mehta', 'Mehta Engineering Works', 'rohan@mehtaeng.example', '+919812300004', 'mid', { utm_source: 'linkedin', utm_medium: 'organic', utm_campaign: 'founder-series' }, { complete: false, upToPhase: 4 }),
];

const worker = new Worker(ctx, { backoffBaseSeconds: 0 });
await worker.drain();
for (const s of seeded) {
  if (s.book === 'clicked' || s.book === 'booked') await recordClick(ctx, s.row);
  if (s.book === 'booked') await recordBooked(ctx, s.row.id, { source: 'webhook', reference: 'DEV-BOOKING-001' });
}
await closePdfBrowser();

console.log('\nSeed complete.\n');
console.log(`Admin sign-in (development only):  ${adminEmail} / ${adminPassword}`);
console.log(`Completed sample (with report):     ${resumeLink(ctx, seeded[0].publicId, seeded[0].token, '/result')}`);
console.log(`Incomplete sample (resume at phase 4): ${resumeLink(ctx, seeded[4].publicId, seeded[4].token)}\n`);
await db.close();
