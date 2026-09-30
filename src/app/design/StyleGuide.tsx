"use client";

import { useState, type ReactNode } from "react";
import { AiBadge, BandPill, Moon } from "@/components/brand";
import { Check, Info, Mic, Upload } from "@/components/icons";
import { Gauge, PillarBars } from "@/components/score";
import { Modal, Toast } from "@/components/feedback";
import { SAMPLE_ANSWERS } from "@/lib/sample";
import { PILLARS } from "@/lib/scorecard";
import s from "./design.module.css";

const PALETTE: [string, string, string, boolean?][] = [
  ["Amber", "#F5A020", "fills", true], ["Orange", "#E8650A", "buttons"], ["Mid", "#D04800", "hover, links"], ["Deep", "#C24000", "orange text"],
  ["Charcoal", "#15120D", "hero only"], ["Ink", "#241B14", "body text"], ["Warm white", "#FFFAF3", "app bg", true], ["Card", "#FFFFFF", "", true],
  ["Line", "#EADBC8", "borders"], ["Muted", "#6B5A4D", "secondary"],
];
const STATUS = [["Red", "#C62828", "#FADBD8"], ["Amber", "#B7791F", "#FDF4E3"], ["Green", "#2E7D32", "#EAF4EB"]];
const LEVELS = ["Absent", "Founder-dependent", "Informal", "Defined", "Managed"];
const HEAT_BG = ["#FADBD8", "#FBE4CC", "#FDF4E3", "#EAF4EB", "#CDE7CF"];
const HEAT: [string, number[]][] = [
  ["Sales", [1, 1, 1, 2, 2]], ["Marketing", [0, 0, 0, 0, 1]], ["Delivery and Operations", [2, 1, 1, 1, 2]],
  ["Purchase and Inventory", [1, 1, 1, 1, 1]], ["Finance and Accounts", [2, 2, 2, 2, 2]], ["People", [1, 0, 0, 0, 1]],
  ["Administration and Compliance", [2, 2, 1, 1, 2]],
];
const WAVE = [5, 11, 18, 26, 34, 22, 14, 29, 36, 20, 9, 16, 27, 33, 24, 12, 7, 19, 30, 25, 15, 21, 32, 17, 10, 23, 13, 6];
const SAMPLE_BARS = PILLARS.map((p, i) => ({ name: p.name, score: SAMPLE_ANSWERS.slice(i * 5, i * 5 + 5).reduce<number>((a, b) => a + (b ?? 0), 0) }));

function Card({ n, kicker, title, children, sub }: { n: string; kicker: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className={s.card}>
      <div className={s.kicker}>{n} · {kicker}</div>
      <h2 className={s.h2} style={sub ? { marginBottom: 6 } : undefined}>{title}</h2>
      {sub && <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6, color: "#6B5A4D", maxWidth: "70ch" }}>{sub}</p>}
      {children}
    </section>
  );
}

const tag = (bg: string, fg: string, border = "none"): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", background: bg, border, borderRadius: 7, fontSize: 11, fontWeight: 700, color: fg });

export function StyleGuide() {
  const [score, setScore] = useState(1);
  const [yn, setYn] = useState(false);
  const [tab, setTab] = useState(0);
  const [rec, setRec] = useState(false);
  const [modal, setModal] = useState(false);

  return (
    <>
      <section style={{ background: "#15120D", borderRadius: 14, padding: "30px 32px", color: "#FFFAF3" }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#F5A020" }}>Design System v1</div>
            <h1 style={{ margin: "10px 0 0", fontSize: 40, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em" }}>Calm, direct, practical.</h1>
            <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: "#EADBC8", maxWidth: "52ch" }}>Most AI courses teach tools. We make your business ready for them — then put them to work.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {([4, 3, 2, 1, 0] as const).map((p) => <Moon key={p} phase={p} size={46} stroke="#F5A020" strokeWidth={1.2} />)}
          </div>
        </div>
      </section>

      <Card n="01" kicker="Colour tokens" title="Palette">
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
          {PALETTE.map(([name, hex, use, border]) => (
            <div key={name}>
              <div className={s.swatch} style={{ background: hex, border: border ? "1px solid #EADBC8" : undefined }} />
              <div className={s.swName}>{name}</div>
              <div className={s.swHex}>{hex}{use && ` · ${use}`}</div>
            </div>
          ))}
        </div>
        <div className={s.grid} style={{ marginTop: 26, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {STATUS.map(([n, fg, tint]) => (
            <div key={n} style={{ border: "1px solid #EADBC8", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: fg, height: 42 }} />
              <div style={{ background: tint, padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: fg }}>{n} {fg} · tint {tint}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card n="02" kicker="Typography" title="Mulish only · 400 / 600 / 700 / 800">
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "14px 24px", alignItems: "baseline" }}>
          {([
            ["Display 40/800", <span key="a" style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1 }}>Your business, AI-ready</span>],
            ["H1 30/800", <span key="b" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Health Scan results</span>],
            ["H2 22/800", <span key="c" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.015em" }}>Purchase and Inventory</span>],
            ["H3 17/700", <span key="d" style={{ fontSize: 17, fontWeight: 700 }}>Quotation approval takes 18 hours</span>],
            ["Body 15/400", <span key="e" style={{ fontSize: 15, lineHeight: 1.6, maxWidth: "62ch" }}>Every score of 2 or more needs evidence — a document, report, photo or meeting note. Without evidence the score is capped at 1.</span>],
            ["Small 13/400", <span key="f" style={{ fontSize: 13, lineHeight: 1.55, color: "#6B5A4D" }}>Scores are calculated by fixed rules. AI only writes the explanations and recommendations.</span>],
            ["Label 11/800", <span key="g" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B5A4D" }}>Founder load</span>],
            ["Numeral 34/800", <span key="h" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#C24000", fontVariantNumeric: "tabular-nums" }}>₹4.2 crore · ₹22 lakh · ₹1,50,000</span>],
          ] as const).map(([l, node]) => (
            <div key={l} style={{ display: "contents" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6B5A4D" }}>{l}</div><div>{node}</div></div>
          ))}
        </div>
      </Card>

      <Card n="03" kicker="Moon-phase motif" title="Outlined circle, pie fill" sub="Used for score bands, progress and journey stages. Keep it subtle — one motif per view, never as decoration.">
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
          {(["New · 0%", "Crescent · 25%", "Half · 50%", "Three-quarter · 75%", "Full · 100%"] as const).map((l, i) => (
            <div key={l} style={{ textAlign: "center" }}><Moon phase={i as 0 | 1 | 2 | 3 | 4} size={40} strokeWidth={1.2} /><div style={{ fontSize: 11, fontWeight: 700, color: "#6B5A4D", marginTop: 4 }}>{l}</div></div>
          ))}
        </div>
        <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <BandPill band="foundation" size="sm" /><BandPill band="getting-ready" size="sm" /><BandPill band="ai-ready" size="sm" />
        </div>
      </Card>

      <Card n="04" kicker="Buttons" title="Actions">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-primary btn-sm">Start my Scorecard</button>
          <button type="button" className="btn btn-outline btn-sm">Save and exit</button>
          <button type="button" className="btn btn-ghost">Skip this section</button>
          <button type="button" className="btn btn-danger btn-sm">Delete audit round</button>
          <button type="button" className="btn btn-sm" disabled>Submit for review</button>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-primary" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5, borderRadius: 8 }}>Small primary</button>
          <button type="button" className="btn btn-primary btn-lg" style={{ width: "100%", maxWidth: 340 }}>Large / mobile full-width</button>
        </div>
      </Card>

      <Card n="05" kicker="Form controls" title="Inputs, ratings, toggles">
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
          <div><label className="field-label" htmlFor="sg-biz">Business name</label><input id="sg-biz" className="input" defaultValue="Kavya Industrial Supplies" /><div style={{ fontSize: 11.5, color: "#6B5A4D", marginTop: 5 }}>As it appears on your GST registration.</div></div>
          <div><label className="field-label" htmlFor="sg-to">Annual turnover</label><select id="sg-to" className="input"><option>₹1 crore – ₹5 crore</option><option>₹5 crore – ₹10 crore</option><option>₹10 crore – ₹25 crore</option></select></div>
          <div><label className="field-label" htmlFor="sg-err">Turnover (error state)</label><input id="sg-err" className="input" aria-invalid defaultValue="42000000000" /><div className="field-error">Enter a figure between ₹1 crore and ₹25 crore.</div></div>
          <div><label className="field-label" htmlFor="sg-notes">Notes for the consultant</label><textarea id="sg-notes" className="input" style={{ minHeight: 92 }} defaultValue="Discounts are approved by me on WhatsApp. No written rule yet." /></div>
        </div>
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #EADBC8" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Maturity rating · 0–4 with level descriptors</div>
          <div style={{ fontSize: 11.5, color: "#6B5A4D", marginBottom: 12 }}>Sales × Process — how well documented is your quotation flow?</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} role="radiogroup" aria-label="Maturity rating">
            {LEVELS.map((l, i) => (
              <button key={l} type="button" role="radio" aria-checked={score === i} className={`${s.rate} ${score === i ? s.rateOn : ""}`} onClick={() => setScore(i)}>
                <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{i}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{l}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 13px", background: "#FDF4E3", border: "1px solid #F5A020", borderRadius: 9, maxWidth: 600 }}>
            <Info style={{ marginTop: 1 }} />
            <div style={{ fontSize: 12, lineHeight: 1.5, color: "#B7791F", fontWeight: 600 }}>
              {score >= 2 ? `Level ${score} needs evidence. Attach a document, report, photo or meeting note, or this score will be capped at 1.` : `Level ${score} needs no evidence. A score of 2 or more does.`}
            </div>
          </div>
        </div>
        <div className={s.grid} style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #EADBC8", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 28 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Yes / no toggle</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" role="switch" aria-checked={yn} aria-label="Written AI usage policy" onClick={() => setYn(!yn)}
                style={{ position: "relative", flex: "none", width: 60, height: 34, borderRadius: 99, cursor: "pointer", padding: 0, border: `1px solid ${yn ? "#2E7D32" : "#EADBC8"}`, background: yn ? "#2E7D32" : "#EADBC8" }}>
                <span style={{ position: "absolute", top: 3, left: yn ? 29 : 3, width: 26, height: 26, borderRadius: 99, background: "#FFFFFF", transition: "left .16s ease" }} />
              </button>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{yn ? "Yes, written and shared" : "No, not yet"}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#6B5A4D", marginTop: 8 }}>Do you have a written AI usage policy?</div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Autosave state</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", background: "#EAF4EB", border: "1px solid #2E7D32", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "#2E7D32" }}><Check size={14} color="#2E7D32" />Saved · 2 minutes ago</span>
            <div style={{ fontSize: 11.5, color: "#6B5A4D", marginTop: 8 }}>Every form autosaves. You can close this and resume later.</div>
          </div>
        </div>
      </Card>

      <Card n="06" kicker="Evidence capture" title="Uploader, evidence chips, voice note">
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 22 }}>
          <div>
            <div style={{ border: "1.5px dashed #F5A020", borderRadius: 12, background: "#FFFAF3", padding: "26px 20px", textAlign: "center" }}>
              <Upload style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>Drop your data pack here</div>
              <div style={{ fontSize: 12, color: "#6B5A4D", marginTop: 4 }}>Tally export, price list, sample invoice · PDF, XLSX, JPG up to 25 MB</div>
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 14, borderWidth: 1.5 }}>Choose files</button>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #EADBC8", borderRadius: 9, background: "#FFFFFF" }}>
                <span style={{ flex: "none", fontSize: 9.5, fontWeight: 800, color: "#FFFFFF", background: "#C62828", padding: "3px 5px", borderRadius: 4 }}>PDF</span>
                <span style={{ flex: "1 1 0", minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sample invoice — KIS-2451.pdf</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2E7D32" }}>Uploaded</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #EADBC8", borderRadius: 9, background: "#FFFFFF" }}>
                <span style={{ flex: "none", fontSize: 9.5, fontWeight: 800, color: "#FFFFFF", background: "#2E7D32", padding: "3px 5px", borderRadius: 4 }}>XLS</span>
                <span style={{ flex: "1 1 0", minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Tally debtors ageing — Aug.xlsx</span>
                <div style={{ flex: "none", width: 72, height: 6, background: "#EADBC8", borderRadius: 99, overflow: "hidden" }}><div style={{ width: "64%", height: "100%", background: "#E8650A" }} /></div>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={tag("#EAF4EB", "#2E7D32", "1px solid #2E7D32")}>Evidence · Invoice sample</span>
              <span style={tag("#EAF4EB", "#2E7D32", "1px solid #2E7D32")}>Evidence · Warehouse photo</span>
              <span style={tag("#FADBD8", "#C62828", "1px solid #C62828")}>No evidence · score capped at 1</span>
            </div>
          </div>
          <div style={{ border: "1px solid #EADBC8", borderRadius: 12, background: "#FFFFFF", padding: 18, alignSelf: "start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button type="button" aria-pressed={rec} aria-label="Record voice note" onClick={() => setRec(!rec)}
                style={{ flex: "none", width: 48, height: 48, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", color: "#FFFFFF", background: rec ? "#C62828" : "#E8650A" }}>
                <Mic size={20} />
              </button>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{rec ? "Recording…" : "Voice note · tap to record"}</div>
                <div style={{ fontSize: 11.5, color: "#6B5A4D" }}>Describe your dispatch process in your own words</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#C24000", fontVariantNumeric: "tabular-nums" }}>{rec ? "0:07" : "0:00"}</span>
            </div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", gap: 3, height: 38 }} aria-hidden="true">
              {WAVE.map((h, i) => <div key={i} style={{ flex: "1 1 0", height: h, borderRadius: 2, background: rec ? "#E8650A" : "#EADBC8" }} />)}
            </div>
            <div style={{ marginTop: 14, padding: 12, background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><AiBadge /><span style={{ fontSize: 11, fontWeight: 700, color: "#6B5A4D" }}>Transcript · English</span></div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>&ldquo;Suresh picks the material, then waits for me to confirm the discount. Sometimes the transporter comes only next morning, so the dispatch slips by a day.&rdquo;</p>
            </div>
          </div>
        </div>
      </Card>

      <Card n="07" kicker="Progress & score" title="Stepper, ring, gauge, pillar bars">
        <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", marginBottom: 28 }}>
          {["Scorecard", "Founder Load", "Health Scan", "Process Walk", "Data Pack"].map((l, i) => (
            <div key={l} style={{ display: "contents" }}>
              {i > 0 && <div style={{ flex: "1 1 40px", height: 2, background: i < 2 ? "#2E7D32" : i === 2 ? "#E8650A" : "#EADBC8", marginTop: 16, minWidth: 24 }} />}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, minWidth: 118 }}>
                <div style={{ width: 34, height: 34, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, ...(i < 2 ? { background: "#2E7D32" } : i === 2 ? { background: "#FFFFFF", border: "2.5px solid #E8650A", color: "#C24000" } : { background: "#FFFAF3", border: "2px solid #EADBC8", color: "#6B5A4D" }) }}>
                  {i < 2 ? <Check /> : i + 1}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: i === 2 ? 800 : 700, color: i === 2 ? "#C24000" : i < 2 ? "#241B14" : "#6B5A4D" }}>{l}</div>
              </div>
            </div>
          ))}
        </div>
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 24, alignItems: "start" }}>
          <div style={{ textAlign: "center" }}>
            <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.1em", marginBottom: 12 }}>Progress ring</div>
            <svg width="118" height="118" viewBox="0 0 120 120" role="img" aria-label="62 percent complete">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#EADBC8" strokeWidth="12" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#E8650A" strokeWidth="12" strokeLinecap="round" strokeDasharray="314.16" strokeDashoffset="119.4" transform="rotate(-90 60 60)" />
              <text x="60" y="56" textAnchor="middle" fontFamily="var(--font)" fontSize="26" fontWeight="800" fill="#241B14">62%</text>
              <text x="60" y="74" textAnchor="middle" fontFamily="var(--font)" fontSize="11" fontWeight="700" fill="#6B5A4D">answered</text>
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.1em", marginBottom: 12 }}>Score gauge</div>
            <Gauge total={38} band="foundation" width={220} numberSize={42} numberY={92} caption="Foundation first · /100" />
            <div style={{ fontSize: 11, color: "#6B5A4D", marginTop: 2 }}>Calculated by fixed rules, not by AI.</div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.1em", marginBottom: 12 }}>Pillar bars · each out of 20</div>
            <PillarBars bars={SAMPLE_BARS} barHeight={9} gap={10} nameSize={12.5} showWeakest={false} />
          </div>
        </div>
      </Card>

      <Card n="08" kicker="Heat map" title="Function × pillar cells" sub="Health Scan, Kavya Industrial Supplies · total 40/140 (29%)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 3, minWidth: 640 }}>
            <thead><tr>
              <th style={{ textAlign: "left", padding: "6px 10px 6px 0", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6B5A4D" }}>Function</th>
              {["Ownership", "Process", "Data", "Numbers & Control", "People & Policy"].map((h) => <th key={h} style={{ padding: "6px 4px", fontSize: 11, fontWeight: 800, color: "#6B5A4D", width: 104 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {HEAT.map(([fn, vs]) => (
                <tr key={fn}>
                  <td style={{ padding: "6px 12px 6px 0", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{fn}</td>
                  {vs.map((v, i) => <td key={i} style={{ textAlign: "center", padding: "12px 4px", borderRadius: 8, fontSize: 15, fontWeight: 800, background: HEAT_BG[v] }}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, fontWeight: 700, color: "#6B5A4D" }}>
          {LEVELS.map((l, i) => <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: HEAT_BG[i], border: "1px solid #EADBC8" }} />{i} {l}</span>)}
        </div>
      </Card>

      <Card n="09" kicker="Findings & badges" title="Finding card, badges, tags">
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))", gap: 18 }}>
          <article style={{ border: "1px solid #EADBC8", borderRadius: 12, background: "#FFFFFF", overflow: "hidden" }}>
            <div style={{ height: 4, background: "#C62828" }} />
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ padding: "3px 8px", background: "#FADBD8", borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#C62828" }}>High risk</span>
                <span style={{ padding: "3px 8px", background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 6, fontSize: 10, fontWeight: 800, color: "#6B5A4D" }}>Sales · Ownership</span>
                <AiBadge />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>Every discount waits for Kiran&rsquo;s approval</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>There is no written discount authority. Rahul sends each quotation to the founder on WhatsApp, which adds an average 18-hour wait before the customer hears back.</p>
              <div style={{ marginTop: 12, display: "flex", gap: 7, flexWrap: "wrap" }}>
                <span style={tag("#EAF4EB", "#2E7D32", "1px solid #2E7D32")}>Evidence · 6 WhatsApp threads</span>
                <span style={tag("#FFFAF3", "#6B5A4D", "1px solid #EADBC8")}>Waste · Waiting</span>
                <span style={tag("#FFFAF3", "#6B5A4D", "1px solid #EADBC8")}>Trap · Approver</span>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #EADBC8", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5, borderRadius: 8 }}>Approve finding</button>
                <button type="button" className="btn btn-outline" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5, borderRadius: 8, borderWidth: 1.5 }}>Edit text</button>
              </div>
            </div>
          </article>
          <article style={{ border: "1px solid #EADBC8", borderRadius: 12, background: "#FFFFFF", overflow: "hidden" }}>
            <div style={{ height: 4, background: "#2E7D32" }} />
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ padding: "3px 8px", background: "#EAF4EB", borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#2E7D32" }}>Strength</span>
                <span style={{ padding: "3px 8px", background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 6, fontSize: 10, fontWeight: 800, color: "#6B5A4D" }}>Finance · Data</span>
                <span style={{ padding: "3px 8px", background: "#FFFFFF", border: "1.5px solid #2E7D32", borderRadius: 6, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", color: "#2E7D32", textTransform: "uppercase" }}>Reviewed by consultant</span>
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>Tally is current to the day</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>Meena posts entries daily and reconciles the bank weekly. This is the cleanest data in the business and the right starting point for a weekly MIS summary.</p>
              <div style={{ marginTop: 12, display: "flex", gap: 7, flexWrap: "wrap" }}>
                <span style={tag("#EAF4EB", "#2E7D32", "1px solid #2E7D32")}>Evidence · Debtors ageing</span>
                <span style={tag("#FDF4E3", "#B7791F", "1px solid #F5A020")}>Use case #5</span>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #EADBC8", fontSize: 11.5, color: "#6B5A4D" }}>Score adjusted 2 → 3 by Priya Shah on 12 Sep. Reason: bank reconciliation seen on site.</div>
            </div>
          </article>
        </div>
      </Card>

      <Card n="10" kicker="Data table & tabs" title="Tables, tabs, side nav, top bar">
        <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid #EADBC8", marginBottom: 18, flexWrap: "wrap" }}>
          {["Assignments", "Evidence", "Activity"].map((t, i) => <button key={t} type="button" role="tab" aria-selected={tab === i} className={`${s.tab} ${tab === i ? s.tabOn : ""}`} onClick={() => setTab(i)}>{t}</button>)}
        </div>
        <div style={{ border: "1px solid #EADBC8", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead><tr style={{ background: "#FFFAF3" }}>{["Person", "Section", "Due", "Status"].map((h) => <th key={h} className={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {([
                  ["Rahul · Sales Coordinator", "Sales", "18 Sep", "Complete", "#EAF4EB", "#2E7D32"],
                  ["Meena · Accounts Executive", "Finance and Accounts", "18 Sep", "In progress · 7/12", "#FDF4E3", "#B7791F"],
                  ["Suresh · Warehouse In-charge", "Delivery and Operations", "20 Sep", "Overdue", "#FADBD8", "#C62828"],
                  ["Hetal · Systems Owner", "Technology, Data and AI", "22 Sep", "Not started", "#FFFAF3", "#6B5A4D"],
                ]).map(([p, sec, due, st, bg, fg]) => (
                  <tr key={p}>
                    <td className={s.td} style={{ fontWeight: 700 }}>{p}</td><td className={s.td}>{sec}</td><td className={s.td} style={{ color: "#6B5A4D" }}>{due}</td>
                    <td className={s.td}><span style={{ padding: "4px 9px", background: bg, border: st === "Not started" ? "1px solid #EADBC8" : "none", borderRadius: 6, fontSize: 11, fontWeight: 800, color: fg }}>{st}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", background: "#FFFAF3", fontSize: 11.5, color: "#6B5A4D" }}>Visible to Kiran Mehta (founder) and the Amalthea audit team only. <a href="/privacy">Privacy notice · DPDP Act, 2023</a></div>
        </div>
      </Card>

      <Card n="11" kicker="Feedback & states" title="Toasts, modal, empty / loading / error">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 460, marginBottom: 24 }}>
          <Toast msg={{ tone: "success", text: "Sales section submitted", detail: "Rahul answered all 14 questions." }} style={{ boxShadow: "0 2px 8px rgba(36,27,20,0.06)" }} />
          <Toast msg={{ tone: "warning", text: "3 scores capped at 1", detail: "Evidence is missing for Purchase and Inventory." }} style={{ boxShadow: "0 2px 8px rgba(36,27,20,0.06)" }} />
          <Toast msg={{ tone: "error", text: "Upload failed", detail: "Tally export is 41 MB. The limit is 25 MB." }} style={{ boxShadow: "0 2px 8px rgba(36,27,20,0.06)" }} />
        </div>
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
          <div style={{ border: "1px dashed #EADBC8", borderRadius: 12, padding: "26px 20px", textAlign: "center", background: "#FFFAF3" }}>
            <Moon phase={0} size={34} stroke="#EADBC8" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>No process walk yet</div>
            <div style={{ fontSize: 12.5, color: "#6B5A4D", marginTop: 5, lineHeight: 1.5 }}>Pick one real order and walk it from enquiry to cash.</div>
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>Start a walk</button>
          </div>
          <div style={{ border: "1px solid #EADBC8", borderRadius: 12, padding: "26px 20px", textAlign: "center", background: "#FFFFFF" }}>
            <svg width="34" height="34" viewBox="0 0 34 34" style={{ marginBottom: 10, animation: "am-spin 1.1s linear infinite" }} aria-hidden="true"><circle cx="17" cy="17" r="14" fill="none" stroke="#EADBC8" strokeWidth="3" /><path d="M17 3a14 14 0 0114 14" fill="none" stroke="#E8650A" strokeWidth="3" strokeLinecap="round" /></svg>
            <div style={{ fontSize: 14, fontWeight: 700 }}>AI is drafting your findings</div>
            <div style={{ fontSize: 12.5, color: "#6B5A4D", marginTop: 5, lineHeight: 1.5 }}>Usually under two minutes. We will email Kiran when it is ready.</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ height: 9, borderRadius: 99, background: "#EADBC8", animation: "am-pulse 1.4s ease-in-out infinite" }} />
              <div style={{ height: 9, borderRadius: 99, background: "#EADBC8", width: "78%", margin: "0 auto", animation: "am-pulse 1.4s ease-in-out .2s infinite" }} />
            </div>
          </div>
          <div style={{ border: "1px solid #C62828", borderRadius: 12, padding: "26px 20px", textAlign: "center", background: "#FADBD8" }}>
            <svg width="34" height="34" viewBox="0 0 20 20" style={{ marginBottom: 10 }} aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="#C62828" strokeWidth="1.6" /><path d="M10 6v5M10 13.4v.1" stroke="#C62828" strokeWidth="1.9" strokeLinecap="round" /></svg>
            <div style={{ fontSize: 14, fontWeight: 700 }}>We could not load this round</div>
            <div style={{ fontSize: 12.5, color: "#6B5A4D", marginTop: 5, lineHeight: 1.5 }}>Your answers are saved. Nothing is lost.</div>
            <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: 14 }}>Try again</button>
          </div>
        </div>
        <div style={{ marginTop: 22 }}><button type="button" className="btn btn-outline btn-sm" onClick={() => setModal(true)}>Preview modal</button></div>
      </Card>

      <Card n="12" kicker="Mobile · 390 px" title="Founder-facing variants" sub="Most founders answer on their phones. 44 px touch targets, one question per screen, sticky action bar. The live Scorecard and result pages are the reference implementations.">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a className="btn btn-outline btn-sm" href="/scorecard">Open the Scorecard</a>
          <a className="btn btn-outline btn-sm" href="/sample-report">Open the sample result</a>
        </div>
      </Card>

      <Card n="13" kicker="Rules" title="Tone, accessibility, content rules">
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 18 }}>
          {([
            ["Tone", ["Calm, direct, practical. Indian English.", "Short sentences. No jargon stacks.", "₹ with Indian grouping: ₹4.2 crore, ₹22 lakh, ₹1,50,000.", "Unconfirmed prices read “₹— (to be confirmed)”."]],
            ["Accessibility", ["WCAG AA contrast throughout.", "No orange text under 18 px on white — use Deep #C24000.", "Visible focus ring: 3 px #E8650A, 2 px offset.", "44 px minimum touch targets on mobile."]],
            ["Hard content rules", ["No income, revenue or profit promises.", "No invented testimonials, logos or statistics.", "AI text carries “Drafted by AI” until a consultant approves.", "Every data screen names who can see the data."]],
          ] as const).map(([h, items]) => (
            <div key={h} style={{ padding: 18, background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 11 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>{h}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>{items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>

      {modal && (
        <Modal title="Submit Sales for consultant review?" onClose={() => setModal(false)}>
          <div style={{ padding: "10px 24px 0" }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>Rahul&rsquo;s 14 answers and 6 evidence files will be locked. Priya Shah will be notified. You can still add evidence to other sections.</p>
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#FDF4E3", border: "1px solid #F5A020", borderRadius: 9, fontSize: 12.5, lineHeight: 1.55, color: "#B7791F", fontWeight: 600 }}>Two Sales scores are capped at 1 because no evidence is attached.</div>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Not yet</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal(false)}>Submit for review</button>
          </div>
        </Modal>
      )}
    </>
  );
}
