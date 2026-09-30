/**
 * The free AI-Readiness Scorecard: statements, options and the fixed scoring
 * rules. Shared by the browser and the server — the server always recomputes
 * scores from raw answers and never trusts a score sent by the client.
 */

export const RATING_LABELS = ["Never", "Rarely", "Sometimes", "Mostly", "Always"] as const;

export interface Pillar {
  name: string;
  blurb: string;
  statements: string[];
}

export const PILLARS: Pillar[] = [
  {
    name: "Ownership",
    blurb: "Who decides, and where AI may act and where a human approves.",
    statements: [
      "Every key function has a named owner other than me.",
      "Routine decisions have written limits my team follows without calling me.",
      "I could be unreachable for a full working day and nothing would stop.",
      "My team knows which tasks need human approval and which do not.",
      "When something goes wrong, we know who fixes the process.",
    ],
  },
  {
    name: "Process",
    blurb: "SOPs that AI can follow.",
    statements: [
      "Our top ten recurring processes are written down.",
      "Written processes are actually followed, not just filed.",
      "A new joiner can learn a task from our documents without asking me.",
      "The same task is done the same way by different people.",
      "When a mistake repeats, we change the process, not just scold the person.",
    ],
  },
  {
    name: "Data",
    blurb: "Clean, structured records in one place.",
    statements: [
      "Our customer, item and price lists each live in one place and are up to date.",
      "Sales, stock and payment records are entered the same day.",
      "We can pull last month's sales by customer or product within minutes.",
      "Important work happens in software or sheets, not only on WhatsApp and paper.",
      "Data entered once is not typed again into another system.",
    ],
  },
  {
    name: "Numbers and Control",
    blurb: "Dashboards and reviews that check results, including AI output.",
    statements: [
      "I see sales, cash and delivery numbers every week without asking.",
      "Each key number has an owner who updates it.",
      "We hold a weekly review with a fixed agenda.",
      "We catch problems before customers complain.",
      "We check the quality of work before it reaches customers, and would do the same for AI output.",
    ],
  },
  {
    name: "People and Policy",
    blurb: "Skills, an AI usage policy and data security.",
    statements: [
      "My team is comfortable using software and learning new tools.",
      "At least one person besides me uses AI tools at work.",
      "We have written rules on what company data can be shared outside, including with AI tools.",
      "Customer and employee data is protected with access controls.",
      "I spend at least half a day a week improving the business, not just running it.",
    ],
  },
];

export const STATEMENT_COUNT = 25;
export const PILLAR_MAX = 20;

export const INDUSTRIES = ["Manufacturing", "Trading", "Services", "Professional services", "Other"] as const;
export const TURNOVER_BANDS = ["Under ₹1 crore", "₹1–3 crore", "₹3–10 crore", "₹10–25 crore", "Above ₹25 crore"] as const;
export const TEAM_SIZES = ["1–7", "8–20", "21–50", "51–80", "80+"] as const;
export const SOFTWARE = [
  "Tally", "Busy", "Zoho", "Excel / Google Sheets", "WhatsApp Business", "CRM", "ERP", "None", "Other",
] as const;

export const OPEN_TEXT_MAX = 500;

export type Answer = 0 | 1 | 2 | 3 | 4 | null;

export interface Details {
  name: string;
  biz: string;
  industry: string;
  city: string;
  turnover: string;
  team: string;
  /** 10-digit Indian mobile number, without +91. */
  wa: string;
  email: string;
  consent: boolean;
}

export const BLANK_DETAILS: Details = {
  name: "", biz: "", industry: "", city: "", turnover: "", team: "", wa: "", email: "", consent: false,
};

export interface OpenAnswers {
  bottleneck: string;
  software: string[];
  automate: string;
}

export const BLANK_OPEN: OpenAnswers = { bottleneck: "", software: [], automate: "" };

export type DetailErrors = Partial<Record<keyof Details, string>>;

export function normaliseMobile(raw: string): string {
  return raw.replace(/[\s-]/g, "").replace(/^(\+?91)(?=\d{10}$)/, "");
}

export function validateDetails(d: Details): DetailErrors {
  const e: DetailErrors = {};
  if (!d.name.trim()) e.name = "Enter your name.";
  if (!d.biz.trim()) e.biz = "Enter your business name.";
  if (!INDUSTRIES.includes(d.industry as (typeof INDUSTRIES)[number])) e.industry = "Choose an industry.";
  if (!d.city.trim()) e.city = "Enter your city.";
  if (!TURNOVER_BANDS.includes(d.turnover as (typeof TURNOVER_BANDS)[number])) e.turnover = "Choose a turnover band.";
  if (!TEAM_SIZES.includes(d.team as (typeof TEAM_SIZES)[number])) e.team = "Choose a team size.";
  if (!/^[6-9]\d{9}$/.test(normaliseMobile(d.wa))) e.wa = "Enter a 10-digit mobile number.";
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = "Enter a valid email, like name@company.in";
  if (!d.consent) e.consent = "Tick this to get your report.";
  return e;
}

export function isValidAnswer(v: unknown): v is Exclude<Answer, null> {
  return v === 0 || v === 1 || v === 2 || v === 3 || v === 4;
}

/** Coerce anything the client sent into exactly 25 answers. */
export function sanitiseAnswers(raw: unknown): Answer[] {
  const src = Array.isArray(raw) ? raw : [];
  return Array.from({ length: STATEMENT_COUNT }, (_, i) => (isValidAnswer(src[i]) ? src[i] : null));
}

export function answeredCount(answers: Answer[]): number {
  return answers.filter((a) => a !== null).length;
}

export function pillarAnswers(answers: Answer[], pillarIndex: number): Answer[] {
  return answers.slice(pillarIndex * 5, pillarIndex * 5 + 5);
}

export function firstIncompletePillar(answers: Answer[]): number {
  for (let p = 0; p < PILLARS.length; p++) {
    if (pillarAnswers(answers, p).some((a) => a === null)) return p;
  }
  return -1;
}

export type BandKey = "foundation" | "getting-ready" | "ai-ready";

export interface Band {
  key: BandKey;
  label: string;
  range: string;
}

export const BANDS: Record<BandKey, Band> = {
  foundation: { key: "foundation", label: "Foundation first", range: "0–40" },
  "getting-ready": { key: "getting-ready", label: "Getting ready", range: "41–70" },
  "ai-ready": { key: "ai-ready", label: "AI-ready", range: "71–100" },
};

export function bandFor(total: number): Band {
  if (total <= 40) return BANDS.foundation;
  if (total <= 70) return BANDS["getting-ready"];
  return BANDS["ai-ready"];
}

export interface Scores {
  total: number;
  pillars: number[];
  band: BandKey;
  /** Index of the lowest pillar; ties go to the earlier pillar. */
  weakest: number;
}

/** Fixed rules: each statement scores 0–4, each pillar sums to 20, the total to 100. */
export function computeScores(answers: Answer[]): Scores {
  if (answers.length !== STATEMENT_COUNT || answers.some((a) => a === null)) {
    throw new Error("All 25 statements must be answered before scoring.");
  }
  const pillars = PILLARS.map((_, p) => pillarAnswers(answers, p).reduce<number>((sum, a) => sum + (a ?? 0), 0));
  const total = pillars.reduce((a, b) => a + b, 0);
  let weakest = 0;
  pillars.forEach((v, i) => {
    if (v < pillars[weakest]) weakest = i;
  });
  return { total, pillars, band: bandFor(total).key, weakest };
}

/** The three lowest pillars, lowest first — the report writes one gap for each. */
export function gapPillars(pillars: number[]): number[] {
  return pillars
    .map((score, index) => ({ score, index }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, 3)
    .map((p) => p.index);
}

export type Route = "low" | "mid" | "high";

/** Next step on the result page is routed by turnover band. */
export function routeFor(turnover: string): Route {
  if (turnover === "Under ₹1 crore") return "low";
  if (turnover === "₹10–25 crore" || turnover === "Above ₹25 crore") return "high";
  return "mid";
}

/** "+91 98••• ••210" — the WhatsApp number as shown back to the founder. */
export function maskMobile(raw: string): string {
  const n = normaliseMobile(raw);
  if (n.length !== 10) return "+91 ••••• •••••";
  return `+91 ${n.slice(0, 2)}••• ••${n.slice(7)}`;
}

/** Arc geometry shared by every score gauge (semicircle, radius 90). */
export const GAUGE_ARC = 282.7;
export function gaugeOffset(total: number): number {
  return Math.round(GAUGE_ARC * (1 - Math.max(0, Math.min(100, total)) / 100) * 10) / 10;
}
