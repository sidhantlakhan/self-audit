"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { AiBadge, Logo, Moon, type MoonPhase } from "@/components/brand";
import { Chevron, Menu } from "@/components/icons";
import { Gauge } from "@/components/score";
import { useToast } from "@/components/feedback";
import { RequestAccess, type AccessKind } from "@/components/RequestAccess";
import { PILLARS } from "@/lib/scorecard";
import { SAMPLE_ANSWERS } from "@/lib/sample";
import s from "./landing.module.css";

const SAMPLE_PILLARS = PILLARS.map((p, i) => ({
  name: p.name,
  score: SAMPLE_ANSWERS.slice(i * 5, i * 5 + 5).reduce<number>((a, b) => a + (b ?? 0), 0),
}));

const PILLAR_TILES = [
  ["Ownership", "Someone must decide where AI may act and where a human approves.", "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2.2 2.2L15.5 10"],
  ["Process", "AI can only follow steps that are written down.", "M5 5h5v5H5zM14 14h5v5h-5zM10 7.5h4a2 2 0 012 2V14"],
  ["Data", "Clean, structured records in one place. Not five.", "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"],
  ["Numbers and Control", "Reviews that check results, including what AI produces.", "M4 20V10M10 20V4M16 20v-7M22 20H2"],
  ["People and Policy", "Skills, an AI usage policy and data security.", "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 6.5a3 3 0 010 5.5M18 14.8c1.8.7 3 2.4 3 5.2"],
] as const;

const HEAT = [[1, 1, 1, 2, 2], [0, 0, 0, 0, 1], [2, 1, 1, 1, 2], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [1, 0, 0, 0, 1], [2, 2, 1, 1, 2]];
const HEAT_BG = ["#FADBD8", "#FBE4CC", "#FDF4E3", "#EAF4EB", "#CDE7CF"];

const FAQS = [
  ["How long does it take?", "The Scorecard takes 10 minutes. A Self-Audit usually runs 2–3 weeks, because your team answers in short sessions. A Consultant-led Audit runs 3–4 weeks. You can save and resume at any point."],
  ["Who in my team fills it in?", "You answer the founder questions. You then assign sections to your team, for example sales to your sales head or accounts to your accounts executive. Each person sees only their own sections."],
  ["Is my data safe?", "Your data is visible only to you, the people you assign and the Amalthea audit team. You can ask us to delete it at any time. See the privacy notice for details under the DPDP Act, 2023."],
  ["Which software do I need?", "None to start. If you use Tally, Excel or WhatsApp, you can upload exports from them in the data pack. A phone is enough for most answers."],
  ["What is the difference between Self-Audit and Consultant-led Audit?", "In a Self-Audit, AI analyses your answers and files and writes the report. In a Consultant-led Audit, an Amalthea consultant also visits, reviews the AI draft, adjusts scores with reasons and approves the final report and roadmap."],
  ["What happens after the report?", "You get a 90-day roadmap with your top three priorities. You can act on it yourself, or work with Amalthea on a six-month implementation. A second audit round later shows what has improved."],
] as const;

interface Tier {
  step: string; name: string; tag: string; moon: MoonPhase; does: string; gets: string; time: string; price: string;
  cta: string; featured?: boolean; action: "scorecard" | AccessKind;
}

const TIERS: Tier[] = [
  {
    step: "Step 1", name: "Free Scorecard", tag: "", moon: 1,
    does: "Answer 25 short statements and 3 open questions about how your business runs.",
    gets: "An instant AI-written report with your score and band.",
    time: "10 minutes", price: site.price.scorecard, cta: "Take the Scorecard", action: "scorecard",
  },
  {
    step: "Step 2", name: "Self-Audit", tag: "The core product", moon: 2, featured: true,
    does: "You and your team answer the guided question bank, walk one real order and upload a data pack.",
    gets: "A Self-Audit Report: Health Scan heat map, AI Opportunity Matrix and top priorities.",
    time: "Guided, 2–3 weeks", price: site.price.selfAudit, cta: "Request Self-Audit access", action: "self_audit",
  },
  {
    step: "Step 3", name: "Consultant-led Audit", tag: "", moon: 4,
    does: "Everything in Self-Audit, plus a site visit and working sessions with an Amalthea consultant.",
    gets: "A consultant-approved report, adjusted scores with reasons and a 90-day roadmap.",
    time: "With Amalthea, 3–4 weeks", price: site.price.consultantAudit, cta: "Talk to a consultant", action: "consultant_audit",
  },
];

const TRUST = "Free · No card needed · Your data stays private";

export function Landing() {
  const [stuck, setStuck] = useState(false);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState(0);
  const [request, setRequest] = useState<AccessKind | null>(null);
  const toast = useToast();

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > (window.innerWidth <= 760 ? 520 : 600));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setMenu(false);

  return (
    <div className={s.page} id="top">
      <header className={s.bar}>
        <a href="#top" className={s.brand} onClick={close} aria-label="Amalthea, back to top">
          <Logo dark />
        </a>
        <nav className={s.nav} aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#sample">Sample report</a>
          <a href="#about">About</a>
          <a href="#faq">FAQ</a>
        </nav>
        <span className={s.spacer} />
        <Link href="/scorecard" className={`btn btn-primary ${s.barBtn} ${stuck ? s.barBtnStuck : ""}`}>Check my AI-readiness — free</Link>
        <button type="button" className={s.menuBtn} aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <Menu />
        </button>
      </header>
      {menu && (
        <nav className={s.mobileMenu} aria-label="Sections">
          <a href="#how" onClick={close}>How it works</a>
          <a href="#sample" onClick={close}>Sample report</a>
          <a href="#about" onClick={close}>About</a>
          <a href="#faq" onClick={close}>FAQ</a>
        </nav>
      )}

      <main>
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
              <div className={s.heroKicker}>AI-Readiness Scorecard · 10 minutes</div>
              <h1 className={s.h1}>Is your business ready for AI?</h1>
              <p className={s.lead}>Most AI courses teach tools. We make your business ready for them — then put them to work.</p>
              <div className={s.heroActions}>
                <Link href="/scorecard" className="btn btn-primary btn-lg">Take the 10-minute Scorecard</Link>
                <a href="#sample" className={s.sampleLink}>See a sample report</a>
              </div>
              <div className={s.trust}>{TRUST}</div>
            </div>
            <div className={s.cardWrap}>
              <HeroPreview />
            </div>
          </div>
        </section>

        <section className={s.sec}>
          <div className={s.wrap}>
            <h2 className={`${s.h2} ${s.h2First}`}>AI multiplies whatever it lands on.</h2>
            <div className={`${s.grid} ${s.g260}`}>
              {[
                ["Processes live in people's heads", "Ask three people how a quotation goes out and you get three answers."],
                ["Data is scattered across Tally, Excel and WhatsApp", "No single place holds the truth about an order, a price or a payment."],
                ["Every decision waits for the founder", "Discounts, dispatch, payments. The business moves at the speed of one phone."],
              ].map(([h, p], i) => (
                <div key={h} className={s.problemCard}>
                  <div className={s.num}>0{i + 1}</div>
                  <h3 className={s.cardH3}>{h}</h3>
                  <p className={s.cardP}>{p}</p>
                </div>
              ))}
            </div>
            <p className={s.closing}>Put AI on top of that and you get faster mess.</p>
          </div>
        </section>

        <section className={`${s.sec} ${s.secWhite}`}>
          <div className={s.wrap}>
            <div className="eyebrow">What we check</div>
            <h2 className={s.h2}>Five pillars of AI-readiness</h2>
            <div className={`${s.grid} ${s.g190}`}>
              {PILLAR_TILES.map(([name, line, icon]) => (
                <div key={name} className={s.pillarTile}>
                  <div className={s.pillarIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={icon} stroke="#C24000" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 style={{ margin: "14px 0 0", fontSize: 17, fontWeight: 800 }}>{name}</h3>
                  <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.55 }}>{line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className={s.sec} style={{ scrollMarginTop: 64 }}>
          <div className={s.wrap}>
            <div className="eyebrow">How it works</div>
            <h2 className={s.h2}>Three steps. Stop at any one.</h2>
            <div className={s.tiers}>
              {TIERS.map((t) => (
                <div key={t.name} className={`${s.tier} ${t.featured ? s.tierFeatured : ""}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Moon phase={t.moon} size={42} strokeWidth={1.2} />
                    <div>
                      <div className={s.tierLabel} style={{ letterSpacing: "0.1em" }}>{t.step}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#C24000", lineHeight: 1.2 }}>{t.name}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#B7791F", minHeight: 16 }}>{t.tag}</div>
                  <div className={s.tierBody}>
                    <div><div className={s.tierLabel}>You do</div><div className={s.tierText}>{t.does}</div></div>
                    <div><div className={s.tierLabel}>You receive</div><div className={s.tierText}>{t.gets}</div></div>
                    <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                      <div><div className={s.tierLabel}>Time</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{t.time}</div></div>
                      <div><div className={s.tierLabel}>Price</div><div style={{ fontSize: 14, fontWeight: 800, marginTop: 3 }}>{t.price}</div></div>
                    </div>
                  </div>
                  {t.action === "scorecard" ? (
                    <Link href="/scorecard" className={`btn btn-outline ${s.tierBtn}`}>{t.cta}</Link>
                  ) : (
                    <button type="button" className={`btn ${t.featured ? "btn-primary" : "btn-outline"} ${s.tierBtn}`} onClick={() => setRequest(t.action as AccessKind)}>
                      {t.cta}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sample" className={`${s.sec} ${s.secWhite}`} style={{ scrollMarginTop: 64 }}>
          <div className={s.wrap}>
            <div className="eyebrow">What you receive</div>
            <h2 className={s.h2}>A report you can act on Monday</h2>
            <div className={`${s.grid} ${s.g250}`}>
              <div>
                <div className={s.thumb} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: "#C62828", lineHeight: 1 }}>38</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#C62828" }}>Foundation first</span>
                  </div>
                  {[100, 88, 94, 60].map((w) => <div key={w} style={{ height: 6, background: "#EADBC8", borderRadius: 9, width: `${w}%` }} />)}
                  <div style={{ marginTop: "auto", fontSize: 10, fontWeight: 800, color: "#6B5A4D" }}>Top 3 priorities</div>
                </div>
                <div className={s.thumbTitle}>Executive summary</div>
                <div className={s.thumbText}>Score, band and top three priorities on one page.</div>
              </div>
              <div>
                <div className={s.thumb} style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gridTemplateRows: "repeat(7,1fr)", gap: 3 }} aria-hidden="true">
                  {HEAT.flat().map((v, i) => <div key={i} style={{ borderRadius: 3, background: HEAT_BG[v] }} />)}
                </div>
                <div className={s.thumbTitle}>Health Scan heat map</div>
                <div className={s.thumbText}>Seven functions across five pillars, scored 0–4.</div>
              </div>
              <div>
                <div className={s.thumb} style={{ position: "relative", overflow: "hidden" }} aria-hidden="true">
                  <div style={{ position: "absolute", left: 22, right: 14, top: 12, bottom: 24, borderLeft: "1.5px solid #6B5A4D", borderBottom: "1.5px solid #6B5A4D" }} />
                  {[["66%", 22, 34], ["44%", 50, 26], ["74%", 78, 20], ["24%", 96, 16]].map(([l, t, d]) => (
                    <div key={String(l)} style={{ position: "absolute", left: l, top: t as number, width: d as number, height: d as number, borderRadius: 99, background: "rgba(245,160,32,0.55)", border: "1.5px solid #B7791F" }} />
                  ))}
                  <div style={{ position: "absolute", left: 8, bottom: 6, fontSize: 9.5, fontWeight: 800, color: "#6B5A4D" }}>Impact × feasibility</div>
                </div>
                <div className={s.thumbTitle}>AI Opportunity Matrix</div>
                <div className={s.thumbText}>Each AI use case plotted by impact, feasibility and data readiness.</div>
              </div>
              <div>
                <div className={s.thumb} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 9, justifyContent: "center" }} aria-hidden="true">
                  {([["Day 1", 34, 0, "#E8650A"], ["Day 30", 52, 14, "#F5A020"], ["Day 60", 40, 40, "#F5A020"], ["Day 90", 28, 68, "#EADBC8"]] as const).map(([d, w, ml, c]) => (
                    <div key={d} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: "#6B5A4D", width: 36, flex: "none" }}>{d}</span>
                      <div style={{ height: 12, width: `${w}%`, marginLeft: `${ml}%`, background: c, borderRadius: 4 }} />
                    </div>
                  ))}
                </div>
                <div className={s.thumbTitle}>90-day roadmap</div>
                <div className={s.thumbText}>Three priorities with owners and dates.</div>
              </div>
            </div>
            <div className={s.sampleRow}>
              <Link href="/sample-report" className="btn btn-outline" style={{ fontSize: 15.5, padding: "0 24px" }}>View sample report</Link>
              <span style={{ fontSize: 12.5, color: "#6B5A4D" }}>Illustrative example · Kavya Industrial Supplies, Rajkot</span>
            </div>
          </div>
        </section>

        <section className={s.sec}>
          <div className={`${s.wrap} ${s.grid} ${s.g340}`}>
            <div className={s.fitCard}>
              <h2 className={s.fitH}>Who it is for</h2>
              <p className={s.fitP}>Businesses with ₹1–25 crore turnover and 8–80 people, in manufacturing, trading or services.</p>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className={s.tag}>Manufacturing</span><span className={s.tag}>Trading</span><span className={s.tag}>Services</span>
              </div>
            </div>
            <div className={s.fitCard}>
              <h2 className={s.fitH}>Not for</h2>
              <ul style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 15.5, lineHeight: 1.7, maxWidth: "52ch" }}>
                <li>Businesses that only want a chatbot.</li>
                <li>Founders not willing to involve their team.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="about" className={`${s.sec} ${s.secDark}`} style={{ scrollMarginTop: 64 }}>
          <div className={s.wrap} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 30, alignItems: "center" }}>
            <div>
              <div className={s.heroKicker}>About Amalthea</div>
              <h2 className={`${s.h2} ${s.h2Light}`}>Founder-led, based in Ahmedabad.</h2>
              <p className={s.aboutP}>We audit and systemise Indian MSMEs — business process audit first, then implementation. More than 100 projects in the last three years.</p>
            </div>
            <div className={s.quoteBox}>
              <Moon phase={3} size={30} stroke="#F5A020" />
              <div className={s.quote}>No income promises — only evidence you can see.</div>
            </div>
          </div>
        </section>

        <section className={`${s.sec} ${s.secWhite}`} style={{ borderTop: "none" }}>
          <div className={s.wrap}>
            <div className="eyebrow">Your data</div>
            <h2 className={s.h2}>Yours. Visible only to who you choose.</h2>
            <div className={`${s.grid} ${s.g240}`}>
              {[
                ["What we collect", "Your contact details, business profile, your answers and the files you upload."],
                ["Who sees it", "You, the team members you assign, and the Amalthea audit team. No one else."],
                ["Where it is stored", `Encrypted cloud storage. Region: ${site.storageRegion}.`],
                ["Deletion", "Ask us and we delete your data. That is your right under the DPDP Act, 2023."],
              ].map(([l, p]) => (
                <div key={l} className={s.dataCard}>
                  <div className={s.dataLabel}>{l}</div>
                  <p className={s.dataP}>{p}</p>
                </div>
              ))}
            </div>
            <Link href="/privacy" className={s.privacyLink}>Read the privacy notice</Link>
          </div>
        </section>

        <section id="faq" className={s.sec} style={{ scrollMarginTop: 64 }}>
          <div className={s.faqWrap}>
            <h2 className={`${s.h2} ${s.h2First}`}>Questions founders ask</h2>
            <div className={s.faqList}>
              {FAQS.map(([q, a], i) => {
                const open = faq === i;
                return (
                  <div key={q} className={s.faqItem}>
                    <button type="button" className={s.faqQ} aria-expanded={open} aria-controls={`faq-${i}`} onClick={() => setFaq(open ? -1 : i)}>
                      <span>{q}</span>
                      <Chevron style={{ transform: `rotate(${open ? 180 : 0}deg)` }} />
                    </button>
                    {open && <p id={`faq-${i}`} className={s.faqA}>{a}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={s.cta}>
          <div className={`${s.wrap} ${s.ctaRow}`}>
            <div>
              <h2 className={s.ctaH}>Find out in 10 minutes</h2>
              <p className={s.ctaP}>{TRUST}</p>
            </div>
            <Link href="/scorecard" className={`btn btn-lg ${s.ctaBtn}`}>Take the 10-minute Scorecard</Link>
          </div>
        </section>
      </main>

      <SiteFooter />

      <div className={`${s.mobileBar} ${stuck ? s.mobileBarOn : ""}`} aria-hidden={!stuck}>
        <Link href="/scorecard" className="btn btn-primary btn-block" tabIndex={stuck ? 0 : -1} style={{ fontSize: 15.5 }}>
          Check my AI-readiness — free
        </Link>
      </div>

      {request && (
        <RequestAccess
          kind={request}
          onClose={() => setRequest(null)}
          onDone={(msg) => {
            setRequest(null);
            toast.show(msg, "success");
          }}
        />
      )}
      {toast.node(stuck ? 84 : 22)}
    </div>
  );
}

function HeroPreview() {
  return (
    <div className={s.previewCard}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B5A4D" }}>Kavya Industrial Supplies · Rajkot</span>
        <span className="illustrative" style={{ padding: "3px 8px", fontSize: 10 }}>Illustrative example</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Gauge total={38} band="foundation" width={132} strokeWidth={18} caption={null} numberSize={52} numberY={100} label="Score 38 out of 100, Foundation first" />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B5A4D" }}>AI-readiness score · /100</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#C62828", marginTop: 2 }}>Foundation first</div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
        {SAMPLE_PILLARS.map((p) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: "0 0 132px", fontSize: 12, fontWeight: 700 }}>{p.name}</span>
            <div style={{ flex: "1 1 0", height: 8, background: "#EADBC8", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${p.score * 5}%`, height: "100%", borderRadius: 99, background: p.score >= 14 ? "#2E7D32" : p.score >= 8 ? "#F5A020" : "#C62828" }} />
            </div>
            <span style={{ flex: "none", width: 34, textAlign: "right", fontSize: 11.5, fontWeight: 800, color: "#C24000", fontVariantNumeric: "tabular-nums" }}>{p.score}/20</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, border: "1px solid #EADBC8", borderRadius: 11, overflow: "hidden" }}>
        <div style={{ height: 3, background: "#C62828" }} />
        <div style={{ padding: "12px 13px" }}>
          <AiBadge />
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>Every discount waits for the founder</div>
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: "#6B5A4D" }}>No written discount rule. Quotations wait about 18 hours for approval.</div>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={`${s.wrap} ${s.footGrid}`}>
        <div>
          <Logo dark size={26} label={site.company} fontSize={16} />
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>{site.city}</div>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
          <div className={s.footLabel}>Contact</div>
          <div><a href={`mailto:${site.contactEmail}`} style={{ color: "#EADBC8" }}>{site.contactEmail}</a></div>
          <div>{site.contactPhone}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className={s.footLabel} style={{ marginBottom: 2 }}>Legal</div>
          <Link href="/privacy" className={s.footLink}>Privacy notice · DPDP Act, 2023</Link>
          <Link href="/terms" className={s.footLink}>Terms of use</Link>
        </div>
      </div>
    </footer>
  );
}
