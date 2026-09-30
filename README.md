# Amalthea AI-Ready Audit Platform

Next.js implementation of the Claude Design handoff in `project/` (the design files) and `chats/` (the design conversation).
This release covers **Stage 0–2**: the design system, the public landing page, and the free AI-Readiness Scorecard with its
AI-written report, PDF and delivery.

| Route | Screen |
|---|---|
| `/` | S1.1 Landing page (desktop + mobile) |
| `/scorecard` | S2.1–S2.10 Start, details, 5 pillar screens, open questions, review, generating (+ resume banner, rate limit, network error) |
| `/scorecard/result/[token]` | S2.11–S2.13 Result, turnover-routed next step, Send to WhatsApp (AI-unavailable fallback included) |
| `/scorecard/result/[token]/print`, `/api/scorecard/[token]/pdf` | S2.14 Two-page A4 PDF |
| `/sample-report` | Illustrative Kavya Industrial Supplies report (stands in for S10.5 until Stage 10) |
| `/privacy`, `/terms`, `/login` | Legal pages and the log-in holding page |
| `/design`, `/design/sitemap`, `/design/founder-shell`, `/design/consultant-shell` | S0.1–S0.4, internal (noindex) |

## How it works

- **Scoring is fixed-rule and server-side** (`src/lib/scorecard.ts`): 25 statements × 0–4, five pillars of 20, total out of 100.
  Bands: 0–40 Foundation first, 41–70 Getting ready, 71–100 AI-ready. The client never sends a score.
- **The report** is one Claude call (`src/lib/server/report-ai.ts`, `claude-opus-5-5`, schema-constrained output). The model
  writes only text; pillar order and scores come from the rules. Server-side refusal fallback (`fallbacks: "default"`) is enabled.
- **If the AI call fails**, the founder sees their final score and the "on its way on WhatsApp" message. `GET /api/cron/retry-reports`
  retries failed reports and sends them. **Schedule it every 5 minutes**, with `Authorization: Bearer $CRON_SECRET`, so the
  30-minute promise holds.
- **Autosave** writes every change to Postgres. The browser keeps the Scorecard token to resume, and "Save and exit" emails a resume link.
- **Rate limit**: 5 starts per device and 25 per network address in 24 hours (configurable).
- **Voice notes** use the browser's speech recognition (en-IN). Only the transcript is stored, and it carries the "Drafted by AI" badge.
- **Leads**: next-step clicks and tier requests are stored in `interest_requests`. Completed Scorecards are in `scorecards`.

## Run locally

```bash
cp .env.example .env.local        # fill in DATABASE_URL at minimum
npm install
npm run db:migrate
npm run dev                       # http://localhost:3000
npm test                          # scoring rules, incl. the Kavya 38/100 sample
```

## Deploy

Any Node 20+ host with Postgres works. PDF rendering needs a Chromium binary on the server (`CHROMIUM_EXECUTABLE_PATH`), so a
container host with Chromium installed is simplest. On serverless, point it at a serverless Chromium build. Set `APP_URL` to the
public URL. WhatsApp and email are each skipped when not configured, and the UI reports which channels actually sent.

## Placeholders to confirm

All unconfirmed business facts live in `src/config/site.ts`, and each can be overridden by env var: contact email and phone,
Self-Audit and Consultant-led prices, data storage region, webinar and booking links. Until they are set, the site shows the
design's approved "to be confirmed" wording.
