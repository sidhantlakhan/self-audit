# New UI mockups

_Started 2026-09-30 08:38 UTC_

---

## User

Make UI mockups for

## Assistant

_[tool: list_files]_

_[tool: list_files]_

Design system project is empty, so your brief is the spec — I'll build it as the canonical style guide. Building Stage 0 now.

_[tool: dc_write]_

_[tool: ready_for_verification]_

Stage 0 is up in one clickable prototype — left rail, four screens.

**S0.1 Style Guide** — full palette with status tints, Mulish scale, the moon-phase motif (outlined circle + pie fill) driving score bands, all four button variants, inputs with error state, live 0–4 rating chips that surface the evidence rule, uploader + evidence chips, voice recorder with AI transcript, stepper, progress ring, score gauge (38/100), pillar bars, the 7×5 heat map at 40/140, finding cards with both badges, toasts, modal, empty/loading/error, data table with the DPDP line, plus 390 px mobile variants of the question screen and the Scorecard result.

**S0.2** — roles, four-column sitemap by tier, and the journey as moon phases. **S0.3 / S0.4** — empty founder and consultant shells, desktop and mobile.

Two notes: the rating chips, toggle, tabs, recorder and modal are live, so you can click through them. Stage IDs S1–S12 in the sitemap are my placeholders — tell me if you want different numbering before Prompt 1.

Waiting for Prompt 1.

## User

PROMPT 1 — LANDING PAGE (public, prospect)
Goal: a founder understands the problem, sees the three tiers and what the report looks like, and starts the free Scorecard.

SCREEN S1.1 — Landing page (desktop 1440 px and mobile 390 px). Sections in this order:
1. Top bar: Amalthea logo with the moon motif; links How it works · Sample report · About · FAQ; "Log in"; primary button "Check my AI-readiness — free".
2. Hero (charcoal background): headline "Is your business ready for AI?"; sub-line "Most AI courses teach tools. We make your business ready for them — then put them to work."; primary button "Take the 10-minute Scorecard"; secondary link "See a sample report"; trust line "Free · No card needed · Your data stays private". Visual: a floating report-preview card with a score gauge (38/100, "Foundation first"), five pillar bars and one finding card with the "Drafted by AI" badge.
3. The problem: title "AI multiplies whatever it lands on." Three cards: "Processes live in people's heads", "Data is scattered across Tally, Excel and WhatsApp", "Every decision waits for the founder". Closing line: "Put AI on top of that and you get faster mess."
4. The five pillars: a row of five tiles (Ownership, Process, Data, Numbers and Control, People and Policy), each with an icon and one line on why AI needs it.
5. How it works: the three tiers as a stepped path — Free Scorecard (10 minutes) → Self-Audit (guided, 2–3 weeks) → Consultant-led Audit (with Amalthea, 3–4 weeks). For each tier show: what you do, what you receive, time needed, price ("Free" or "₹— (to be confirmed)"), button.
6. What you receive: four report thumbnails (Executive summary, Health Scan heat map, AI Opportunity Matrix, 90-day roadmap) and a "View sample report" button that opens S10.5 (illustrative mode).
7. Who it is for: ₹1–25 crore businesses with 8–80 people in manufacturing, trading or services. Not for: businesses that only want a chatbot, or founders not willing to involve their team.
8. About Amalthea: founder-led consultancy in Ahmedabad; business process audit and implementation for Indian MSMEs; 100+ projects in the last three years. Line: "No income promises — only evidence you can see."
9. Your data: what we collect, who sees it, where it is stored, deletion on request; link to the privacy notice.
10. FAQ accordion (6 questions): How long does it take? · Who in my team fills it in? · Is my data safe? · Which software do I need? · What is the difference between Self-Audit and Consultant-led Audit? · What happens after the report?
11. Final call-to-action band in amber: "Find out in 10 minutes" + button. Footer with contact, privacy notice, terms.

INTERACTIONS
- Sticky CTA after scrolling past the hero (desktop: top bar button highlights; mobile: bottom bar).
- Anchor links scroll smoothly to sections.
- Tier cards lift on hover; the middle tier is visually emphasised.
- All Scorecard buttons link to S2.1.

ACCEPTANCE
- The Scorecard button is visible above the fold at 390 px.
- Line length under 75 characters; headings in Deep #C24000 or white on charcoal.
- Nothing breaks the Global rules (no income claims, no invented testimonials).

Deliver S1.1 desktop and mobile, linked to S2.1 and S10.5. Stop and wait for Prompt 2.

## Assistant

_[tool: dc_write]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

S1.1 is in the prototype, in desktop (1440) and mobile (390) frames. Each frame scrolls on its own.

- **Sections:** all 11, in your order.
- **Sticky CTA:** after the hero, the desktop top-bar button highlights and a bottom bar appears on mobile.
- **Anchor links:** the nav links scroll smoothly to their sections.
- **Tier cards:** they lift on hover, and Self-Audit is emphasised.
- **Scorecard buttons:** the target screens (S2.1, S10.5) aren't built yet, so the buttons show a "Opens S2.1…" or "Opens S10.5…" toast.
- **Placeholders:**
  - Storage region reads "India (to be confirmed)".
  - The footer email and phone are placeholders.
  - The three report thumbnails are my own simplified drawings, not real report screens.

Waiting for Prompt 2.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I fixed the broken top bar on the desktop landing frame. The frame is now a fixed 1440 px width and scrolls sideways if your preview pane is narrower. The nav links and "Log in" also no longer wrap onto two lines. I haven't re-checked the top bar visually, and I skipped the automatic verification pass.

Waiting for Prompt 2.

## User

<pasted_text name="Pasted text (45 lines)">
PROMPT 2 — FREE AI-READINESS SCORECARD (public, prospect)
Goal: in 10 minutes a founder answers 25 statements and 3 open questions, gets an instant score, and receives an AI-written report that makes the next step obvious.

SCREENS (desktop and mobile for all)
S2.1 Start: title "How AI-ready is your business?"; what you get (score out of 100, five pillar scores, a personal report with three gaps, three AI use cases, three first actions); "10 minutes · 25 questions · free"; privacy line; button "Start".

S2.2 Your details: name; business name; industry (Manufacturing, Trading, Services, Professional services, Other); city; turnover band (Under ₹1 crore / ₹1–3 crore / ₹3–10 crore / ₹10–25 crore / Above ₹25 crore); team size (1–7 / 8–20 / 21–50 / 51–80 / 80+); WhatsApp number (+91); email; required consent checkbox "I agree that Amalthea may contact me about my results" with a privacy-notice link. Show inline validation errors.

S2.3 to S2.7: one pillar per screen, five statements each. Each statement uses rating chips 0 Never · 1 Rarely · 2 Sometimes · 3 Mostly · 4 Always. Stepper at the top with five moon icons that fill as pillars are completed; Back / Next; autosave.
Ownership: (1) Every key function has a named owner other than me. (2) Routine decisions have written limits my team follows without calling me. (3) I could be unreachable for a full working day and nothing would stop. (4) My team knows which tasks need human approval and which do not. (5) When something goes wrong, we know who fixes the process.
Process: (6) Our top ten recurring processes are written down. (7) Written processes are actually followed, not just filed. (8) A new joiner can learn a task from our documents without asking me. (9) The same task is done the same way by different people. (10) When a mistake repeats, we change the process, not just scold the person.
Data: (11) Our customer, item and price lists each live in one place and are up to date. (12) Sales, stock and payment records are entered the same day. (13) We can pull last month's sales by customer or product within minutes. (14) Important work happens in software or sheets, not only on WhatsApp and paper. (15) Data entered once is not typed again into another system.
Numbers and Control: (16) I see sales, cash and delivery numbers every week without asking. (17) Each key number has an owner who updates it. (18) We hold a weekly review with a fixed agenda. (19) We catch problems before customers complain. (20) We check the quality of work before it reaches customers, and would do the same for AI output.
People and Policy: (21) My team is comfortable using software and learning new tools. (22) At least one person besides me uses AI tools at work. (23) We have written rules on what company data can be shared outside, including with AI tools. (24) Customer and employee data is protected with access controls. (25) I spend at least half a day a week improving the business, not just running it.

S2.8 Three open questions: (a) "What is the biggest bottleneck in your business today?" (text or voice note, 500 characters); (b) "Which software do you use?" (multi-select chips: Tally, Busy, Zoho, Excel / Google Sheets, WhatsApp Business, CRM, ERP, None, Other); (c) "Name one task you would most like to automate" (text or voice note).

S2.9 Review: pillar-by-pillar summary, collapsible, with "Edit" links; button "Get my report".

S2.10 Generating (15–30 seconds): animated checklist — Scoring your answers ✓ → Comparing your pillars ✓ → Writing your report → Preparing your PDF. Note: "Your score is calculated by fixed rules. AI only writes the explanation."

S2.11 Result page, using Kavya's sample data:
- Score gauge 38/100 with the band "Foundation first" and its moon icon; five pillar bars (Ownership 9, Process 7, Data 5, Numbers and Control 8, People and Policy 9, each out of 20); weakest pillar highlighted.
- "What your score means" (AI badge): "Kavya runs on Kiran's time and memory. Data sits across Tally, Excel and WhatsApp, and most decisions wait for him. Before AI can help, three foundations are needed: written limits for routine decisions, a few core SOPs, and one clean customer and item list."
- "Your three biggest gaps": three cards (pillar, gap, why it matters).
- "Three AI use cases that fit your business": three cards (use case, what must exist first, effort: Low / Medium / High).
- "Your first three actions": a checklist.
- Next-step block routed by turnover band: ₹1–10 crore → "Join the free webinar" + "Book a 20-minute audit call"; above ₹10 crore → "Book an audit call" as primary; under ₹1 crore → "Join the free webinar".
- Buttons: Download PDF · Send to WhatsApp · Start your Self-Audit (goes to S3.1).
S2.12 Mobile result layout (390 px), score first, sections collapsible.
S2.13 Delivery confirmation: toast "Report sent to WhatsApp +91 98••• ••210 and your email".
S2.14 Two-page A4 PDF of the result (light theme, Mulish, amber accents).
S2.15 Resume banner shown to someone who closed the tab halfway: "Pick up where you left off — 14 of 25 answered".

STATES TO SHOW
- Validation errors on S2.2; unanswered statements highlighted on Next.
- Network error with Retry.
- AI unavailable: show scores immediately with "Your detailed report is on its way on WhatsApp" (fallback template).
- Too many attempts from one device: a polite rate-limit message.

ACCEPTANCE
- Exactly 25 statements plus 3 open questions; each pillar screen fits one phone screen with thumb-reachable chips.
- Scores match the sample data; every AI-written block carries the badge.

Deliver S2.1–S2.15, linked from S1.1 and on to S3.1. Stop and wait for Prompt 3.
</pasted_text>

## Assistant

_[tool: dc_write]_

_[tool: run_script]_

_[tool: ready_for_verification]_

S2.1–S2.15 are built and open in the prototype, plus a "Error and edge states" screen. The verifier is still checking it, so I haven't seen it render.

- **Flow:** S1.1's Scorecard buttons now go to S2.1. Each frame is live, so you can click Start, fill the details, answer the chips, record a voice note and reach the result.
- **Sample answers:** the pillar screens have a "Prototype helper: fill with sample answers" link so you don't have to answer all 25. The sample answers give 9, 7, 5, 8 and 9 across the pillars, which is 38/100 in total.
- **Result:** it always shows the Kavya sample data, and every AI block carries the "Drafted by AI" badge. A small "preview routing by turnover" control switches the next-step block between the three turnover routes.
- **Edge states:** validation errors, unanswered statements, network error with Retry, AI unavailable and the rate-limit message each have a frame.
- **Not yet linked:** "Start your Self-Audit" shows a "goes to S3.1" toast until Prompt 3.
- **PDF (S2.14):** the two A4 pages use 15px body text and may run tight. I haven't checked them for overflow.
- **Placeholders:** the contact email and phone number are placeholders.

Waiting for Prompt 3.

