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
| `/privacy`, `/terms` | Privacy notice (DPDP Act, 2023) and terms of use |
| `/design`, `/design/sitemap`, `/design/founder-shell`, `/design/consultant-shell` | S0.1–S0.4, internal (noindex) |

## How it works

- **Scoring is fixed-rule and server-side** (`src/lib/scorecard.ts`): 25 statements × 0–4, five pillars of 20, total out of 100.
  Bands: 0–40 Foundation first, 41–70 Getting ready, 71–100 AI-ready. The client never sends a score.
- **The report** is one Claude call (`src/lib/server/report-ai.ts`, `claude-opus-5-5`, schema-constrained output). The model
  writes only text; pillar order and scores come from the rules. Server-side refusal fallback (`fallbacks: "default"`) is enabled.
- **If the AI call fails**, the founder sees their final score and the "on its way on WhatsApp" message. `GET /api/cron/retry-reports`
  retries failed reports and sends them. It runs every 5 minutes on Vercel (`vercel.json`), so the 30-minute promise holds.
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

## Deploy to Vercel (phase 1: no log-in, no payments)

1. **Plan:** Vercel **Pro**. Hobby is for non-commercial use only and does not allow the 5-minute retry job in `vercel.json`.
2. **Import** `sidhantlakhan/self-audit` in Vercel. The framework is detected as Next.js. Functions run in Mumbai (`bom1`).
3. **Database:** in Vercel → Storage, add **Neon Postgres** (Mumbai region). It sets `DATABASE_URL`. Migrations run on
   every deploy (`vercel-build` script).
4. **Environment variables** (Project → Settings → Environment Variables), from `.env.example`:
   `ANTHROPIC_API_KEY`, `CRON_SECRET` (Vercel sends it to the retry job automatically), `IP_HASH_SALT`, `APP_URL` (your domain),
   WhatsApp and Resend credentials, and any `NEXT_PUBLIC_*` business facts. **Do not set `CHROMIUM_EXECUTABLE_PATH` on Vercel.**
   The PDF then uses the bundled serverless Chromium (`@sparticuz/chromium`).
5. **Domain (GoDaddy):** add the domain in Vercel → Domains, then in GoDaddy DNS set an `A` record for `@` to `76.76.21.21` and a
   `CNAME` for `www` to `cname.vercel-dns.com` (or use the exact values Vercel shows). HTTPS is issued automatically.

Other hosts: any Node 20+ server with Postgres and Chromium works. Set `CHROMIUM_EXECUTABLE_PATH` there and call
`GET /api/cron/retry-reports` every 5 minutes with `Authorization: Bearer $CRON_SECRET`.

## Placeholders to confirm

All unconfirmed business facts live in `src/config/site.ts`, and each can be overridden by env var: contact email and phone,
Self-Audit and Consultant-led prices, data storage region, webinar and booking links. Until they are set, the site shows the
design's approved "to be confirmed" wording.
