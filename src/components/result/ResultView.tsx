"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { site } from "@/config/site";
import { AiBadge, BandPill, Moon } from "@/components/brand";
import { Check, Chevron, Info, Spinner } from "@/components/icons";
import { Gauge, PillarBars } from "@/components/score";
import { useToast } from "@/components/feedback";
import { PILLARS, type BandKey, type Route } from "@/lib/scorecard";
import type { Effort, ReportContent } from "@/lib/report";
import s from "./result.module.css";

export interface ResultData {
  title: string;
  illustrative: boolean;
  total: number;
  pillars: number[];
  weakest: number;
  band: BandKey;
  report: ReportContent | null;
  route: Route;
  maskedWa: string;
  /** Present for a real Scorecard; absent for the public sample. */
  token?: string;
  pdfHref: string | null;
}

const EFFORT: Record<Effort, [string, string]> = { Low: ["#EAF4EB", "#2E7D32"], Medium: ["#FDF4E3", "#B7791F"], High: ["#FADBD8", "#C62828"] };

export const NEXT_STEP: Record<Route, { title: string; body: string; primary: string; primaryKind: "webinar" | "audit_call"; secondary?: string }> = {
  low: {
    title: "Join the free webinar",
    body: "Learn how to get processes and data ready before you add AI. A good first step for a business at your size.",
    primary: "Join the free webinar", primaryKind: "webinar",
  },
  mid: {
    title: "Join the free webinar, or talk to us",
    body: "The webinar covers your three gaps in 45 minutes. If you would rather go through your report with a consultant, book a short call.",
    primary: "Join the free webinar", primaryKind: "webinar", secondary: "Book a 20-minute audit call",
  },
  high: {
    title: "Book an audit call",
    body: "At your size, a consultant-led audit is usually the right fit. Book a call and we will walk through this report and scope the audit.",
    primary: "Book an audit call", primaryKind: "audit_call",
  },
};

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

type SectionKey = "meaning" | "gaps" | "cases" | "actions";

export function ResultView({ data }: { data: ResultData }) {
  const m = useIsMobile();
  const toast = useToast(4200);
  const [openSec, setOpenSec] = useState<Record<SectionKey, boolean>>({ meaning: true, gaps: false, cases: false, actions: false });
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [sending, setSending] = useState(false);
  const r = data.report;
  const next = NEXT_STEP[data.route];

  const isOpen = (k: SectionKey) => !m || openSec[k];
  const bars = PILLARS.map((p, i) => ({ name: p.name, score: data.pillars[i], weakest: i === data.weakest }));
  const gapScore = (name: string) => data.pillars[PILLARS.findIndex((p) => p.name === name)] ?? 0;

  async function interest(kind: "webinar" | "audit_call" | "self_audit") {
    const url = kind === "webinar" ? site.webinarUrl : kind === "audit_call" ? site.bookingUrl : "";
    if (!data.token) {
      window.location.href = "/scorecard";
      return;
    }
    if (url) window.open(url, "_blank", "noopener");
    const ok = await fetch("/api/interest", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, token: data.token }),
    }).then((res) => res.ok).catch(() => false);
    if (!ok) return toast.show("We could not send your request. Check your connection and try again.", "error");
    if (url) return;
    toast.show(
      kind === "self_audit"
        ? `Request received. The Amalthea team will contact you on WhatsApp ${data.maskedWa} to set up your Self-Audit.`
        : kind === "webinar"
          ? `You are on the list. We will send the webinar details to WhatsApp ${data.maskedWa}.`
          : `Request received. We will call you on ${data.maskedWa} to fix a time.`,
      "success",
    );
  }

  async function send() {
    if (!data.token) return;
    setSending(true);
    try {
      const res = await fetch(`/api/scorecard/${data.token}/send`, { method: "POST" });
      const d = await res.json();
      if (d.whatsapp && d.email) toast.show(`Report sent to WhatsApp ${d.to} and your email`, "success");
      else if (d.whatsapp) toast.show(`Report sent to WhatsApp ${d.to}`, "success");
      else if (d.email) toast.show("Report sent to your email", "success", { detail: "WhatsApp delivery is not available right now." });
      else toast.show("We could not send the report right now. Please download the PDF instead.", "error");
    } catch {
      toast.show("We could not reach the server. Check your connection and try again.", "error");
    } finally {
      setSending(false);
    }
  }

  const Section = ({ k, title, children }: { k: SectionKey; title: string; children: ReactNode }) => (
    <section className={s.panel}>
      {m ? (
        <button type="button" className={s.panelHead} aria-expanded={isOpen(k)} onClick={() => setOpenSec({ ...openSec, [k]: !openSec[k] })}>
          <span className={s.panelTitleRow}><h2 className={s.panelTitle}>{title}</h2><AiBadge /></span>
          <Chevron style={{ transform: `rotate(${isOpen(k) ? 180 : 0}deg)` }} />
        </button>
      ) : (
        <div className={s.panelHead}>
          <span className={s.panelTitleRow}><h2 className={s.panelTitle}>{title}</h2><AiBadge /></span>
        </div>
      )}
      {isOpen(k) && <div className={s.panelBody}>{children}</div>}
    </section>
  );

  return (
    <div className={s.root}>
      <header className={s.header}>
        <Link href="/" aria-label="Amalthea home" style={{ display: "flex" }}><Moon phase={2} size={26} strokeWidth={1.4} /></Link>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>AI-Readiness Scorecard</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B5A4D" }}>{data.illustrative ? "Sample report" : "Your result"}</div>
        </div>
      </header>

      <main className={s.main}>
        <div className={s.titleRow}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div className="eyebrow">Your AI-Readiness Scorecard</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>{data.title}</div>
          </div>
          {data.illustrative && <span className="illustrative">Illustrative example</span>}
          {data.pdfHref && <a href={data.pdfHref} target="_blank" rel="noopener" className={`btn btn-outline btn-sm ${s.desktopOnly}`}>Download PDF</a>}
        </div>

        <div className={s.scoreGrid}>
          <div className={s.scoreCard}>
            <Gauge total={data.total} band={data.band} label={`Score ${data.total} out of 100`} />
            <div style={{ marginTop: 6 }}><BandPill band={data.band} /></div>
            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: "#6B5A4D" }}>Bands: 0–40 Foundation first · 41–70 Getting ready · 71–100 AI-ready</div>
          </div>
          <div className={s.card}>
            <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.1em", marginBottom: 14 }}>Five pillars · each out of 20</div>
            <PillarBars bars={bars} />
          </div>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#6B5A4D" }}>Scores are calculated by fixed rules. AI only writes the explanations and recommendations.</div>

        {!r ? (
          <div className={s.aiDown} role="status">
            <Info size={26} style={{ marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Your detailed report is on its way on WhatsApp</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, maxWidth: "60ch" }}>
                Our AI writer is busy right now. Your score above is final. We will send the full report with your gaps, AI use cases and first actions to WhatsApp <span style={{ whiteSpace: "nowrap" }}>{data.maskedWa}</span> within 30 minutes.
              </p>
            </div>
          </div>
        ) : (
          <>
            <Section k="meaning" title="What your score means">
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7, maxWidth: "68ch" }}>{r.meaning}</p>
            </Section>
            <Section k="gaps" title="Your three biggest gaps">
              <div className={s.cards3}>
                {r.gaps.map((g) => (
                  <div key={g.pillar} className={s.inner}>
                    <span className={s.gapTag}>{g.pillar} · {gapScore(g.pillar)}/20</span>
                    <div style={{ marginTop: 9, fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{g.gap}</div>
                    <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6 }}><strong>Why it matters:</strong> {g.why}</div>
                  </div>
                ))}
              </div>
            </Section>
            <Section k="cases" title="Three AI use cases that fit your business">
              <div className={s.cards3}>
                {r.useCases.map((c) => (
                  <div key={c.name} className={s.inner} style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{c.name}</div>
                    <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.6, flex: "1 1 auto" }}><strong>Must exist first:</strong> {c.mustExistFirst}</div>
                    <div style={{ marginTop: 12 }}><EffortTag effort={c.effort} /></div>
                  </div>
                ))}
              </div>
            </Section>
            <Section k="actions" title="Your first three actions">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {r.actions.map((a, i) => {
                  const on = !!done[i];
                  return (
                    <button key={i} type="button" role="checkbox" aria-checked={on} className={s.action} onClick={() => setDone({ ...done, [i]: !on })}>
                      <span className={s.actionBox} style={{ background: on ? "#2E7D32" : "#FFFFFF", borderColor: on ? "#2E7D32" : "#E8650A" }}>{on && <Check size={14} />}</span>
                      <span style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: 600, color: on ? "#6B5A4D" : "#241B14", textDecoration: on ? "line-through" : "none" }}>{a}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          </>
        )}

        <section className={s.nextStep}>
          <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.1em" }}>Your next step</div>
          {data.illustrative ? (
            <>
              <h2 className={s.nextTitle}>Find out your own score in 10 minutes</h2>
              <p className={s.nextBody}>This report is an illustrative example. Take the free Scorecard to get your own score, gaps and first actions.</p>
              <div className={s.btnRow}><Link href="/scorecard" className="btn btn-primary btn-block-m">Take the 10-minute Scorecard</Link></div>
            </>
          ) : (
            <>
              <h2 className={s.nextTitle}>{next.title}</h2>
              <p className={s.nextBody}>{next.body}</p>
              <div className={s.btnRow}>
                <button type="button" className="btn btn-primary btn-block-m" onClick={() => interest(next.primaryKind)}>{next.primary}</button>
                {next.secondary && <button type="button" className="btn btn-outline btn-block-m" onClick={() => interest("audit_call")}>{next.secondary}</button>}
              </div>
            </>
          )}
        </section>

        {!data.illustrative && (
          <div className={s.btnRow}>
            {data.pdfHref && <a href={data.pdfHref} target="_blank" rel="noopener" className="btn btn-outline btn-block-m">Download PDF</a>}
            {r && (
              <button type="button" className="btn btn-outline btn-block-m" onClick={send} disabled={sending}>
                {sending ? <><Spinner /> Sending…</> : "Send to WhatsApp"}
              </button>
            )}
            <button type="button" className={`btn btn-primary ${s.desktopOnly}`} onClick={() => interest("self_audit")}>Start your Self-Audit</button>
          </div>
        )}
        {data.illustrative && data.pdfHref && (
          <div className={s.btnRow}><a href={data.pdfHref} target="_blank" rel="noopener" className="btn btn-outline btn-block-m">Download PDF</a></div>
        )}
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "#6B5A4D" }}>
          {data.illustrative ? "Illustrative example based on a fictional business. " : "Visible only to you and the Amalthea audit team. "}
          <Link href="/privacy">Privacy notice · DPDP Act, 2023</Link>
        </div>
      </main>

      {!data.illustrative && (
        <div className={s.mobileBar}>
          <button type="button" className="btn btn-primary btn-block" onClick={() => interest("self_audit")}>Start your Self-Audit</button>
        </div>
      )}
      {toast.node(m && !data.illustrative ? 84 : 22)}
    </div>
  );
}

export function EffortTag({ effort }: { effort: Effort }) {
  const [bg, fg] = EFFORT[effort];
  return <span style={{ flex: "none", display: "inline-block", padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 800, background: bg, color: fg }}>Effort: {effort}</span>;
}
