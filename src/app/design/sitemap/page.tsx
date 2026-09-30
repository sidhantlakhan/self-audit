import type { Metadata } from "next";
import { Moon, type MoonPhase } from "@/components/brand";
import s from "../design.module.css";

export const metadata: Metadata = { title: "S0.2 Sitemap & Roles" };

const ROLES = [
  ["Prospect", "Not signed in. Landing page and Scorecard only."],
  ["Founder · Kiran Mehta", "Owns the audit, answers founder questions, assigns sections, sees everything.", true],
  ["Team member", "Invited by the founder. Sees only assigned sections."],
  ["Consultant", "Reviews AI drafts, edits findings, adjusts scores with reasons, approves. Tier 3."],
  ["Project Manager", "Tracks deadlines and client communication across audits."],
  ["Admin", "Question banks, prompts, use-case library, users and plans."],
] as const;

type Col = { label: string; title: string; sub: string; phase: MoonPhase; head: "dark" | "amber" | "white" | "warm"; rows: [string, string, boolean?][]; foot: string };

const COLS: Col[] = [
  {
    label: "Public", title: "Tier 1 · Free Scorecard", sub: "10 minutes · lead capture", phase: 0, head: "dark", foot: "Desktop 1440 + mobile 390",
    rows: [
      ["S1.1", "Landing page · hero, belief, three tiers", true], ["S2.1", "Scorecard start & privacy", true], ["S2.2", "Your details · consent", true],
      ["S2.3–7", "25 statements, one pillar per screen", true], ["S2.8", "Three open questions · voice notes", true], ["S2.9–10", "Review · generating", true],
      ["S2.11–13", "Result · routed next step · delivery", true], ["S2.14", "Two-page A4 PDF", true], ["S10.5", "Sample report, illustrative", true],
    ],
  },
  {
    label: "Founder + team", title: "Tier 2 · Self-Audit", sub: "Guided workspace · AI report", phase: 2, head: "amber", foot: "Desktop 1440 + mobile 390",
    rows: [
      ["S3.x", "Onboarding · business profile, round setup"], ["S4.x", "Founder Load · Do / Delegate / Design / Delete"], ["S5.x", "Health Scan · 7 functions × 5 pillars"],
      ["S6.x", "Process Walk · enquiry to cash"], ["S7.x", "Data Pack upload · Tally, price list, invoices"], ["S8.x", "AI Opportunity Matrix · impact × feasibility"],
      ["S9.x", "Self-Audit Report · Drafted by AI"], ["S9.x", "90-day roadmap · top 3 priorities"],
    ],
  },
  {
    label: "+ Consultant", title: "Tier 3 · Consultant-led BPA", sub: "Same workspace + review and approval", phase: 4, head: "white", foot: "Desktop only",
    rows: [
      ["S10.1", "Consultant audit queue"], ["S10.2", "Review AI draft findings side by side"], ["S10.3", "Site-visit observations & photos"],
      ["S10.4", "Score adjustment with reason"], ["S10.5", "Approve report · Reviewed by consultant"], ["S10.6", "Roadmap builder → 6-month implementation"],
    ],
  },
  {
    label: "Amalthea internal", title: "PM & Admin", sub: "Across all audits and rounds", phase: 3, head: "warm", foot: "Desktop only",
    rows: [
      ["S11.1", "PM board · deadlines by audit"], ["S11.2", "Client communication log"], ["S12.1", "Question bank editor"],
      ["S12.2", "AI prompt library & versions"], ["S12.3", "Use-case library"], ["S12.4", "Users, roles and plans"],
    ],
  },
];

const HEAD = {
  dark: { background: "#15120D", title: "#FFFAF3", sub: "#EADBC8", label: "#F5A020", border: "none" },
  amber: { background: "#FDF4E3", title: "#241B14", sub: "#6B5A4D", label: "#C24000", border: "1px solid #F5A020" },
  white: { background: "#FFFFFF", title: "#241B14", sub: "#6B5A4D", label: "#C24000", border: "1px solid #EADBC8" },
  warm: { background: "#FFFAF3", title: "#241B14", sub: "#6B5A4D", label: "#6B5A4D", border: "1px solid #EADBC8" },
};

const JOURNEY: [string, string, MoonPhase][] = [
  ["Scorecard", "10 minutes, free. You learn your band.", 0], ["Self-Audit", "Question bank, process walk, data pack.", 1],
  ["Consultant review", "Site visit, adjusted scores, approval.", 2], ["90-day roadmap", "Top 3 priorities, owners, dates.", 3],
  ["Implementation", "Six months. Then Round 2 compares.", 4],
];

export default function SitemapPage() {
  return (
    <>
      <section className={s.card}>
        <h2 className={s.h2} style={{ margin: "0 0 6px" }}>Roles and what each one can reach</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#6B5A4D" }}>Audits run in versioned Audit Rounds, so Round 1 and Round 2 can be compared.</p>
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(215px,1fr))", gap: 12 }}>
          {ROLES.map(([r, d, hi]) => (
            <div key={r} style={{ padding: 15, background: hi ? "#FDF4E3" : "#FFFAF3", border: `1px solid ${hi ? "#F5A020" : "#EADBC8"}`, borderRadius: 11 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{r}</div>
              <div style={{ fontSize: 12, color: "#6B5A4D", marginTop: 5, lineHeight: 1.55 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={s.card}>
        <h2 className={s.h2} style={{ margin: "0 0 6px" }}>Sitemap · three tiers on one platform</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#6B5A4D" }}>Screen IDs are assigned per stage (S2.3 = Stage 2, screen 3). Screens marked live are built; the rest arrive with their prompts.</p>
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(252px,1fr))", gap: 16, alignItems: "start" }}>
          {COLS.map((c) => {
            const h = HEAD[c.head];
            return (
              <div key={c.title} style={{ border: "1px solid #EADBC8", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: h.background, padding: "14px 16px", borderBottom: h.border }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Moon phase={c.phase} size={18} stroke={h.label} fill={c.head === "warm" ? "#EADBC8" : "#F5A020"} strokeWidth={1.5} />
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: h.label }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: h.title, marginTop: 6 }}>{c.title}</div>
                  <div style={{ fontSize: 11.5, color: h.sub, marginTop: 3 }}>{c.sub}</div>
                </div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7, background: "#FFFFFF" }}>
                  {c.rows.map(([id, t, live]) => (
                    <div key={id + t} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                      <span style={{ flex: "none", fontSize: 10, fontWeight: 800, color: "#C24000", width: 48 }}>{id}</span>
                      <span style={{ fontSize: 12.5 }}>{t}</span>
                      {live && <span style={{ marginLeft: "auto", flex: "none", fontSize: 9.5, fontWeight: 800, color: "#2E7D32", background: "#EAF4EB", padding: "1px 6px", borderRadius: 5 }}>Live</span>}
                    </div>
                  ))}
                </div>
                <div style={{ padding: "9px 14px", background: "#FFFAF3", borderTop: "1px solid #EADBC8", fontSize: 10.5, fontWeight: 700, color: "#6B5A4D" }}>{c.foot}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={s.card}>
        <h2 className={s.h2} style={{ margin: "0 0 18px" }}>The journey, as moon phases</h2>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start" }}>
          {JOURNEY.map(([t, d, p]) => (
            <div key={t} style={{ flex: "1 1 150px", minWidth: 130, textAlign: "center" }}>
              <Moon phase={p} size={44} />
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: "#6B5A4D", lineHeight: 1.5, marginTop: 3 }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, padding: "15px 18px", background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 11, fontSize: 14, fontWeight: 700 }}>
          AI multiplies whatever it lands on. A messy process plus AI gives you faster mess.
        </div>
      </section>
    </>
  );
}
