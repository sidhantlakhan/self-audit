# AI Readiness Diagnostic

A business diagnostic that measures whether an organisation has the foundations — ownership, processes, data, systems, people, controls and visibility — for AI to work reliably, and where AI appears relevant to it.

It is **not** an AI quiz, an implementation tool or a roadmap generator. It never recommends tools, vendors or implementation steps. The single commercial call to action is **Book Consultation**.

```
Landing → Intake (consent) → 6 phases (autosave) → Review → Complete
   → deterministic scoring → AI interpretation → Result → 7-page PDF report → Book Consultation
```

## Principles enforced in code

| Principle | Where |
|---|---|
| Scores are deterministic; AI never scores | `src/server/scoring/*` is a pure function of answers + versioned config. AI input/output contain no score fields and output is linted against the supplied scores (`src/server/ai/guardrails.ts`). |
| Readiness ≠ opportunity | Separate engines: `scoring/engine.ts` (readiness) and `scoring/opportunity.ts` (opportunity profile). Shown as two facts everywhere; adoption intent (Q6.7) is labelled separately. |
| No solutions in the diagnostic | System prompt (`ai/prompts.ts`) + a guardrail linter that rejects roadmaps, prescriptive language, vendor/tool names the respondent did not supply, outcome promises and invented figures. Rejected output is retried once with the reasons, then fails safe. |
| Everything is configuration | Questions, options, scoring maps, weights, bands, industry/turnover/team lists, source categories: `src/shared/config/`. Prompts: `src/server/ai/prompts.ts`. Report: `src/server/report/render.ts`. |
| History is reproducible | Each assessment stores `assessment_version`, `scoring_version`, `prompt_version`, `report_version`. Reports render from stored score + AI snapshots. Config versions are persisted in `config_versions`; editing a released version throws in production. |

## Stack

- **Runtime**: Node 20+, TypeScript (ESM)
- **API**: Fastify 5 (+ helmet CSP, cookie, rate-limit), zod validation
- **Database**: PostgreSQL via `pg`; embedded **PGlite** (`pglite:` URLs) for zero-install development and tests. Hand-written SQL migrations in `migrations/`.
- **Jobs**: database-backed queue (`jobs` table) with atomic claim (`FOR UPDATE SKIP LOCKED`), retry with backoff, timeouts, stale-lock recovery and a unique index preventing duplicate live jobs.
- **AI**: provider abstraction — `anthropic` (Messages API over `fetch`, key server-side only) or `mock` (deterministic, offline; refused in production).
- **Report**: HTML/CSS → A4 PDF with headless Chromium (`playwright-core`), Mulish embedded, page numbers via CSS counters.
- **Frontend**: React 19 + React Router 7 + Vite 8. The landing page is server-rendered for SEO; everything else is code-split and `noindex`. Mulish via `@fontsource` (self-hosted).
- **Tests**: Vitest (unit, integration, security, admin) and a Playwright browser E2E.

## Local setup

```bash
npm install
cp .env.example .env            # defaults work out of the box (PGlite + mock AI)
npm run migrate                 # create the schema
npm run seed                    # sample data + a development admin
npm run dev                     # API :3000 + Vite :5173  → open http://localhost:5173
```

`npm run seed` prints the development admin credentials (`admin@example.local` / `dev-admin-pass-1234`, development only — the seed refuses to run in production) and a resume link for a completed sample (with a PDF report) and for an unfinished one.

PDF generation needs Chromium. Where Playwright's browser is not installed, set `CHROMIUM_PATH` to a Chrome/Chromium binary.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + Vite dev server with `/api` proxy |
| `npm run build` | client bundle + SSR bundle + server bundle into `dist/` |
| `npm start` | run the production build (`node dist/server/index.js`) |
| `npm run migrate` | apply pending SQL migrations |
| `npm run seed` | development seed data |
| `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run admin:create` | create/reset an admin (≥12 char password) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit + integration + security + admin tests (in-memory DB) |
| `npm run test:e2e` | browser journey (requires `npm run build`) |

## Environment variables

See `.env.example`. Required in production: `DATABASE_URL` (PostgreSQL), `APP_URL` (https), `SESSION_SECRET`, `RESUME_TOKEN_SECRET`, `ADMIN_AUTH_SECRET`, `BOOKING_WEBHOOK_SECRET` (each ≥ 32 chars), `AI_PROVIDER=anthropic`, `AI_API_KEY`, `AI_MODEL`, `BOOKING_URL`. The server refuses to start in production with weak secrets, the mock AI provider, a PGlite database or a non-https `APP_URL`.

Optional: `EMAIL_PROVIDER` (`console`|`resend`|`none`) + `EMAIL_API_KEY` + `EMAIL_FROM`, `WHATSAPP_PROVIDER` (`none`|`console`), `ANALYTICS_PROVIDER` (`internal`|`none`), `SUPPORT_EMAIL` (shown in the privacy notice), `TRUST_PROXY=1` behind a load balancer, `CHROMIUM_PATH`, `WORKER_ENABLED`.

## Architecture

```
src/shared/        config (questions, scoring maps, bands, lists), validation, types — used by client AND server
src/server/
  app.ts           Fastify wiring: helmet CSP, cookies, rate limits, error handler, static/SSR
  routes/          public.ts (respondent API) · admin.ts · common.ts (auth gates) · static.ts
  services/        assessments · analysis · reports · consultation · notifications · analytics · admin · result · config-sync
  scoring/         question.ts · engine.ts · founder.ts · opportunity.ts   (pure, deterministic)
  ai/              prompts.ts (versioned) · provider.ts · mock.ts · schema.ts · guardrails.ts
  report/          render.ts (HTML) · pdf.ts (Chromium)
  jobs/            queue.ts · worker.ts
  notify/          provider abstractions (email, WhatsApp)
  db/client.ts     pg / PGlite driver + migrator
src/client/        landing (SSR) · intake · assessment runner · result · privacy · admin
migrations/        001_init.sql · 002_consent.sql
tests/             scoring · api · security · admin · e2e
```

### Request flow on completion

1. `POST /complete` validates every required answer server-side, writes an immutable **snapshot**, runs the **scoring engine**, stores overall/dimension scores and indicators, creates the AI-analysis row and enqueues an `analysis` job — all in one transaction. Calling it twice is a no-op.
2. The worker runs the AI interpretation (timeout, retries 3× with backoff). Output is schema-validated and guardrail-linted. On success it enqueues the `report` job; on exhaustion `analysis_status = failed` and the deterministic result remains available. Admins can retry from the dashboard.
3. The report job renders the PDF from the stored snapshots and stores it with its version.
4. The result page shows the deterministic score immediately and polls for the interpretation and report.

## Security summary

- Public assessment access = random 132-bit `public_id` **plus** a 256-bit bearer token. Only an HMAC of the token is stored; tokens expire after 90 days; the token travels in the URL **fragment** (never sent to a server, stripped from the address bar on load). Every probe — unknown id, wrong token, another person’s id — returns an identical 401, and repeated failures are throttled per client.
- Resume by email + mobile never reveals whether a match exists; it emails a fresh link.
- Admin: scrypt password hashes, server-side sessions (HMAC-hashed cookie token, HttpOnly, SameSite=Strict, Secure in production), CSRF token + origin check on writes, per-account and per-IP lockout, constant-time-ish failure path, audit log for logins, views and actions.
- Strict CSP (self only), HSTS in production, `no-store` + `noindex` on API, request bodies never logged, secrets only from environment, AI key never leaves the server.
- AI receives answers and business context but **not** name, email, mobile, business name or any internal id. The input snapshot and hash are stored for traceability.
- Analytics events carry an allow-list of non-personal properties only.

## Consultation booking

`BOOKING_URL` can be any scheduler that accepts query-string prefill. The result page links to it with `name`, `email`, `phone`, `company`, `assessment_id`, `readiness_score`, `readiness_band`, `opportunity_profile`, `utm_*` and `source_category`. Clicking records `consultation_clicked`.

A booking is marked **booked** only by (a) the signed webhook `POST /api/webhooks/booking` (HMAC-SHA256 of the raw body in `X-Signature: sha256=<hex>`, secret `BOOKING_WEBHOOK_SECRET`; accepts `{assessment_id, booking_reference, booked_at}` or a Cal.com `BOOKING_CREATED` payload that carries `assessment_id`), or (b) an admin (“Mark as booked”, audited). The browser can never self-report a booking, so the primary KPI cannot be inflated. Repeats are idempotent: the first booking time and reference are kept and a late job can never downgrade the status.

## Known limitations

- **Calibration**: the scoring maps, weights and bands are an initial calibration chosen to reflect the meaning of each question; they have not been validated against real respondent data. Recalibrate by adding `v2` config rather than editing `v1`.
- **Question wording**: the brief names some questions only by topic (Q3.2–Q3.5, Q3.7, Q4.4–Q4.6, Q5.1–Q5.2, Q5.9–Q5.11, etc.); the full question text for those was written for this build and should be reviewed.
- **Ranking (Q6.4)** asks for the respondent’s top three outcomes (configurable via `rankCount`), not a full ranking of nine.
- **Q5.7 and Q5.8** (comfort with AI autonomy; activities to restrict) are treated as unscored context for the interpretation; Q5.3 (AI ownership) is scored as a governance signal.
- **Report PDF** is stored in the database (`bytea`), which suits report volumes in the thousands; move to object storage beyond that.
- **Job queue** runs in-process with the API. It is safe to run several instances (atomic claim), but a dedicated worker process is advisable at scale.
- **Rate limiting** is in-memory per instance; use a shared store (e.g. Redis) behind multiple instances. The bad-token throttle is likewise per instance.
- **Email/WhatsApp**: console and Resend email adapters are implemented; WhatsApp is an interface with a console stub. Add a provider in `src/server/notify/providers.ts`.
- **Voice input** relies on the browser’s Web Speech API (Chrome, Edge, Safari); Firefox hides the control gracefully.
- **Admin** has a single role; no user-management UI (`admin:create` script).
- **Data retention/deletion** is manual (delete the assessment row; cascades remove all related records).

## Deployment

1. Provision PostgreSQL 14+ and set `DATABASE_URL`.
2. Set production environment variables (above). Generate secrets with `openssl rand -hex 32`.
3. `npm ci && npm run build`, then `npm run migrate && npm run admin:create`.
4. `npm start` behind HTTPS (set `TRUST_PROXY=1` if behind a proxy). Install Chromium on the host (or set `CHROMIUM_PATH`) for report PDFs; in containers it needs `--no-sandbox`, already passed.
5. Point your scheduler’s booking webhook at `/api/webhooks/booking` with the shared secret.
6. Health check: `GET /api/health`.

## Future enhancements

CSV export of assessments; admin user management and roles; shared rate-limit store; object storage for PDFs; WhatsApp Cloud API adapter; email open/click tracking; question-level analytics (drop-off by question); scoring recalibration tooling with score-distribution reports; multilingual question sets; a read-only public sample report in illustrative mode.
