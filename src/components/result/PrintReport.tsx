import { site } from "@/config/site";
import { AiBadge, BAND_COLOURS, Moon } from "@/components/brand";
import { Gauge, PillarBars } from "@/components/score";
import { BANDS, PILLARS } from "@/lib/scorecard";
import { EffortTag, type ResultData } from "./ResultView";
import s from "./print.module.css";

const PDF_NEXT = {
  low: { title: "Join the free webinar", body: "Bring this report. We will show how to get processes and data ready before you add AI." },
  mid: { title: "Join the free webinar · Book a 20-minute audit call", body: "Bring this report. We will walk through your three gaps and what a Self-Audit would cover." },
  high: { title: "Book an audit call", body: "Bring this report. We will walk through your three gaps and scope a consultant-led audit." },
} as const;

/** S2.14 — two A4 pages, light theme. Rendered to PDF by headless Chromium. */
export function PrintReport({ data }: { data: ResultData }) {
  const r = data.report;
  const band = BAND_COLOURS[data.band];
  const subtitle = `${data.title}${data.illustrative ? " · Illustrative example" : ""}`;
  const bars = PILLARS.map((p, i) => ({ name: p.name, score: data.pillars[i], weakest: i === data.weakest }));
  const gapScore = (name: string) => data.pillars[PILLARS.findIndex((p) => p.name === name)] ?? 0;
  const next = PDF_NEXT[data.route];

  const Head = ({ withCompany }: { withCompany?: boolean }) => (
    <div className={s.head}>
      <Moon phase={2} size={30} strokeWidth={1.4} />
      <div style={{ flex: "1 1 0" }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>AI-Readiness Scorecard</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6B5A4D" }}>{subtitle}</div>
      </div>
      {withCompany && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6B5A4D" }}>{site.company}</div>}
    </div>
  );

  const SecTitle = ({ children }: { children: string }) => (
    <div className={s.secTitle}><div style={{ fontSize: 19, fontWeight: 800, color: "#C24000" }}>{children}</div><AiBadge style={{ fontSize: 10 }} /></div>
  );

  return (
    <div className={s.sheetWrap}>
      <div className={s.page}>
        <Head withCompany />
        <div style={{ marginTop: 22, display: "flex", gap: 26, alignItems: "center" }}>
          <div style={{ flex: "none", textAlign: "center", width: 230 }}>
            <Gauge total={data.total} band={data.band} width={230} />
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px", background: band.tint, border: `1px solid ${band.fg}`, borderRadius: 999, fontSize: 14, fontWeight: 800, color: band.fg }}>
              {BANDS[data.band].label}
            </div>
          </div>
          <div style={{ flex: "1 1 0" }}>
            <PillarBars bars={bars} barHeight={9} gap={11} showWeakest={false} />
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6B5A4D" }}>Scores are calculated by fixed rules. AI only writes the explanations.</div>
        {r && (
          <>
            <SecTitle>What your score means</SecTitle>
            <p style={{ margin: "8px 0 0", fontSize: 15.5, lineHeight: 1.65 }}>{r.meaning}</p>
            <SecTitle>Your three biggest gaps</SecTitle>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {r.gaps.map((g) => (
                <div key={g.pillar} className={s.gap}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#C62828", textTransform: "uppercase", letterSpacing: "0.04em" }}>{g.pillar} · {gapScore(g.pillar)}/20</div>
                  <div style={{ marginTop: 3, fontSize: 15.5, fontWeight: 800 }}>{g.gap}</div>
                  <div style={{ marginTop: 3, fontSize: 14, lineHeight: 1.55 }}><strong>Why it matters:</strong> {g.why}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ flex: "1 1 auto" }} />
        <div className={s.foot}>
          <span>{data.illustrative ? "Illustrative example based on a fictional business" : "Visible only to you and the Amalthea audit team"} · Privacy notice, DPDP Act, 2023</span>
          <span>Page 1 of 2</span>
        </div>
      </div>

      <div className={s.page}>
        <Head />
        {r && (
          <>
            <SecTitle>Three AI use cases that fit your business</SecTitle>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {r.useCases.map((c) => (
                <div key={c.name} className={s.useCase}>
                  <div style={{ flex: "1 1 0" }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800 }}>{c.name}</div>
                    <div style={{ marginTop: 3, fontSize: 14, lineHeight: 1.55 }}><strong>Must exist first:</strong> {c.mustExistFirst}</div>
                  </div>
                  <EffortTag effort={c.effort} />
                </div>
              ))}
            </div>
            <SecTitle>Your first three actions</SecTitle>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 9 }}>
              {r.actions.map((a) => (
                <div key={a} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ flex: "none", width: 20, height: 20, border: "2px solid #E8650A", borderRadius: 5, marginTop: 2 }} />
                  <span style={{ fontSize: 15, lineHeight: 1.55 }}>{a}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className={s.next}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B5A4D" }}>Your next step</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#C24000" }}>{next.title}</div>
          <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>{next.body}</div>
        </div>
        <div style={{ flex: "1 1 auto" }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>{site.company}, Ahmedabad · {site.contactEmail} · {site.contactPhone}</div>
        <div className={s.foot} style={{ marginTop: 10 }}>
          <span>This report makes no income or revenue promises. Scores use fixed rules.</span>
          <span>Page 2 of 2</span>
        </div>
      </div>
    </div>
  );
}
