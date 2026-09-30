"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/config/site";
import { AiBadge, MOON_PATHS, Moon, type MoonPhase } from "@/components/brand";
import { Check, Chevron, Mic, Spinner } from "@/components/icons";
import { useToast } from "@/components/feedback";
import { useDictation } from "@/components/useDictation";
import {
  BLANK_DETAILS, BLANK_OPEN, INDUSTRIES, OPEN_TEXT_MAX, PILLARS, RATING_LABELS, SOFTWARE, TEAM_SIZES, TURNOVER_BANDS,
  answeredCount, firstIncompletePillar, pillarAnswers, sanitiseAnswers, validateDetails,
  type Answer, type Details, type OpenAnswers,
} from "@/lib/scorecard";
import s from "./scorecard.module.css";

const STORAGE_KEY = "amalthea.scorecard.token";

type Screen =
  | { k: "loading" }
  | { k: "start" }
  | { k: "details" }
  | { k: "pillar"; p: number }
  | { k: "open" }
  | { k: "review" }
  | { k: "generating" };

type SaveState = "idle" | "saving" | "saved" | "offline";
type Voice = { bottleneck?: boolean; automate?: boolean };

const GEN_STEPS = ["Scoring your answers", "Comparing your pillars", "Writing your report", "Preparing your PDF"];

const GETS: [string, string, MoonPhase][] = [
  ["Score out of 100", "One number, calculated by fixed rules.", 4],
  ["Five pillar scores", "Ownership, Process, Data, Numbers and Control, People and Policy.", 3],
  ["A personal report with three gaps", "What holds you back, in plain words.", 3],
  ["Three AI use cases", "That fit a business like yours.", 2],
  ["Three first actions", "A checklist you can start this week.", 1],
];

const readToken = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};
const writeToken = (t: string | null) => {
  try { if (t) localStorage.setItem(STORAGE_KEY, t); else localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function ScorecardFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const dictation = useDictation();

  const [screen, setScreen] = useState<Screen>({ k: "loading" });
  const [token, setToken] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(BLANK_DETAILS);
  const [answers, setAnswers] = useState<Answer[]>(() => sanitiseAnswers([]));
  const [open, setOpen] = useState<OpenAnswers>(BLANK_OPEN);
  const [voice, setVoice] = useState<Voice>({});
  const [tried, setTried] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resume, setResume] = useState<{ answered: number; when: string } | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [revOpen, setRevOpen] = useState<Record<number, boolean>>({});
  const [gen, setGen] = useState(0);
  const [netErr, setNetErr] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ token, details, answers, open, voice });
  latest.current = { token, details, answers, open, voice };

  const go = useCallback((next: Screen) => {
    setTried(false);
    setScreen(next);
    window.scrollTo({ top: 0 });
  }, []);

  // ---- Load an existing draft (resume link or this device) ----
  useEffect(() => {
    const fromLink = params.get("resume");
    const t = fromLink || readToken();
    if (!t) return setScreen({ k: "start" });
    (async () => {
      try {
        const res = await fetch(`/api/scorecard/${t}`);
        if (!res.ok) throw new Error("gone");
        const d = await res.json();
        if (d.status !== "draft") {
          if (fromLink) return router.replace(`/scorecard/result/${t}`);
          writeToken(null);
          return setScreen({ k: "start" });
        }
        writeToken(t);
        setToken(t);
        setDetails(d.details);
        setAnswers(sanitiseAnswers(d.answers));
        setOpen(d.open);
        setVoice(d.voiceUsed ?? {});
        setSave("saved");
        if (d.answered > 0) {
          const p = firstIncompletePillar(sanitiseAnswers(d.answers));
          setResume({ answered: d.answered, when: d.updatedAt });
          setScreen(p >= 0 ? { k: "pillar", p } : { k: "open" });
        } else if (Object.keys(validateDetails(d.details)).length < 9) {
          setScreen({ k: "details" });
        } else {
          setScreen({ k: "start" });
        }
      } catch {
        writeToken(null);
        setScreen({ k: "start" });
      }
    })();
  }, [params, router]);

  // ---- Autosave ----
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(saveTimer.current);
    const cur = latest.current;
    if (!cur.token || !dirty.current) return true;
    dirty.current = false;
    setSave("saving");
    try {
      const res = await fetch(`/api/scorecard/${cur.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details: cur.details, answers: cur.answers, open: cur.open, voiceUsed: cur.voice }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSave("saved");
      return true;
    } catch {
      dirty.current = true;
      setSave("offline");
      saveTimer.current = setTimeout(() => void flush(), 4000);
      return false;
    }
  }, []);

  const touch = useCallback(() => {
    dirty.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 700);
  }, [flush]);

  useEffect(() => {
    const onHide = () => {
      const cur = latest.current;
      if (!cur.token || !dirty.current) return;
      const body = JSON.stringify({ details: cur.details, answers: cur.answers, open: cur.open, voiceUsed: cur.voice });
      fetch(`/api/scorecard/${cur.token}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const setDetail = <K extends keyof Details>(k: K, v: Details[K]) => {
    setDetails((d) => ({ ...d, [k]: v }));
    touch();
  };
  const setAnswer = (i: number, v: Answer) => {
    setAnswers((a) => a.map((x, j) => (j === i ? v : x)));
    touch();
  };
  const setOpenField = <K extends keyof OpenAnswers>(k: K, v: OpenAnswers[K]) => {
    setOpen((o) => ({ ...o, [k]: v }));
    touch();
  };

  // ---- Actions ----
  async function start() {
    setStarting(true);
    try {
      // Reuse an untouched draft rather than starting another one.
      if (token && answeredCount(answers) === 0) return go({ k: "details" });
      const res = await fetch("/api/scorecard", { method: "POST" });
      if (res.status === 429) return setRateLimited(true);
      if (!res.ok) throw new Error(String(res.status));
      const { token: t } = await res.json();
      writeToken(t);
      setToken(t);
      setDetails(BLANK_DETAILS);
      setAnswers(sanitiseAnswers([]));
      setOpen(BLANK_OPEN);
      setVoice({});
      go({ k: "details" });
    } catch {
      toast.show("We could not reach the server. Check your connection and try again.", "error");
    } finally {
      setStarting(false);
    }
  }

  async function saveAndExit() {
    await flush();
    let emailed = false;
    if (token) {
      emailed = await fetch(`/api/scorecard/${token}/save-exit`, { method: "POST" })
        .then((r) => r.json()).then((d) => !!d.emailed).catch(() => false);
    }
    toast.show(
      emailed ? "Progress saved. You can resume from the link we email you." : "Progress saved. Open this page on this device to continue.",
      "success",
    );
    setTimeout(() => router.push("/"), 1800);
  }

  function startOver() {
    setAnswers(sanitiseAnswers([]));
    setResume(null);
    touch();
    go({ k: "pillar", p: 0 });
  }

  async function runGeneration(from = 0) {
    const t = latest.current.token;
    if (!t) return;
    setNetErr(false);
    go({ k: "generating" });
    const minStep = async <T,>(p: Promise<T>) => (await Promise.all([p, sleep(900)]))[0];
    try {
      let step = from;
      if (step <= 0) {
        setGen(0);
        if (!(await flush())) throw new Error("save");
        const res = await minStep(fetch(`/api/scorecard/${t}/submit`, { method: "POST" }));
        if (res.status === 422) {
          const e = await res.json();
          toast.show(e.error === "details_incomplete" ? "Some of your details need attention." : "Some statements are unanswered.", "warning");
          return go(e.error === "details_incomplete" ? { k: "details" } : { k: "pillar", p: e.pillar ?? 0 });
        }
        if (!res.ok) throw new Error(String(res.status));
        step = 1;
      }
      if (step <= 1) {
        setGen(1);
        await sleep(700);
        step = 2;
      }
      let aiDown = false;
      if (step <= 2) {
        setGen(2);
        const res = await minStep(fetch(`/api/scorecard/${t}/report`, { method: "POST" }));
        if (!res.ok) throw new Error(String(res.status));
        aiDown = !(await res.json()).ok;
        step = 3;
      }
      setGen(3);
      if (!aiDown) await minStep(fetch(`/api/scorecard/${t}/prepare-pdf`, { method: "POST" }).catch(() => null));
      setGen(4);
      writeToken(null);
      await sleep(600);
      router.push(`/scorecard/result/${t}`);
    } catch {
      setNetErr(true);
    }
  }

  function next() {
    if (screen.k === "details") {
      if (Object.keys(validateDetails(details)).length) {
        setTried(true);
        return toast.show("Fix the highlighted fields to continue.", "warning");
      }
      void flush();
      return go({ k: "pillar", p: 0 });
    }
    if (screen.k === "pillar") {
      const miss = pillarAnswers(answers, screen.p).filter((a) => a === null).length;
      if (miss) {
        setTried(true);
        return toast.show(miss === 1 ? "1 statement needs an answer." : `${miss} statements need an answer.`, "warning");
      }
      void flush();
      return go(screen.p < 4 ? { k: "pillar", p: screen.p + 1 } : { k: "open" });
    }
    if (screen.k === "open") {
      void flush();
      return go({ k: "review" });
    }
    if (screen.k === "review") {
      const missing = 25 - answeredCount(answers);
      if (missing) return toast.show(`${missing} statements are unanswered. Tap Edit to fill them.`, "warning");
      return void runGeneration(0);
    }
  }

  function back() {
    if (screen.k === "details") go({ k: "start" });
    else if (screen.k === "pillar") go(screen.p === 0 ? { k: "details" } : { k: "pillar", p: screen.p - 1 });
    else if (screen.k === "open") go({ k: "pillar", p: 4 });
    else if (screen.k === "review") go({ k: "open" });
  }

  function toggleVoice(key: "bottleneck" | "automate") {
    if (dictation.active === key) return dictation.stop();
    const r = dictation.start(key, (text) => {
      setOpen((o) => {
        const cur = o[key];
        return { ...o, [key]: (cur ? `${cur} ${text}` : text).slice(0, OPEN_TEXT_MAX) };
      });
      setVoice((v) => ({ ...v, [key]: true }));
      touch();
    });
    if (r === "unsupported") toast.show("Voice notes need Chrome or Edge on this device. Please type your answer.", "warning");
    if (r === "denied") toast.show("Allow microphone access to record a voice note.", "warning");
  }

  // ---- Render ----
  const k = screen.k;
  const showBar = k === "details" || k === "pillar" || k === "open" || k === "review";
  const crumb =
    k === "start" ? "Free · 10 minutes"
    : k === "details" ? "Step 1 of 3 · Your details"
    : k === "pillar" ? `Step 2 of 3 · ${PILLARS[screen.p].name}`
    : k === "open" ? "Step 3 of 3 · Open questions"
    : k === "review" ? "Review"
    : k === "generating" ? "Generating" : "";
  const wide = k === "start";
  const errors = validateDetails(details);
  const showErr = tried;
  const answered = answeredCount(answers);

  return (
    <div className={s.root}>
      <header className={s.header}>
        <Moon phase={2} size={26} strokeWidth={1.4} />
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div className={s.headTitle}>AI-Readiness Scorecard</div>
          <div className={s.crumb}>{crumb}</div>
        </div>
        {showBar && save !== "idle" && (
          <span className={`${s.saved} ${save === "offline" ? s.unsaved : ""}`} aria-live="polite">
            {save === "offline" ? "Not saved · retrying" : save === "saving" ? "Saving…" : <><Check size={12} color="#2E7D32" />Saved</>}
          </span>
        )}
        {showBar && <button type="button" className={`${s.exit} ${s.onlyDesktop}`} onClick={saveAndExit}>Save and exit</button>}
      </header>

      {resume && k === "pillar" && (
        <div className={s.resume}>
          <Moon phase={3} size={26} stroke="#B7791F" strokeWidth={1.4} />
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Pick up where you left off — {resume.answered} of 25 answered</div>
            <div style={{ fontSize: 12.5, color: "#6B5A4D", marginTop: 2 }}>Saved {ago(resume.when)}.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setResume(null)}>Continue</button>
            <button type="button" className="btn btn-ghost" onClick={startOver}>Start over</button>
          </div>
        </div>
      )}

      <main ref={mainRef} className={`${s.main} ${wide ? s.mainWide : ""}`}>
        {k === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={34} /></div>
        )}

        {k === "start" && (
          <div className={s.startGrid}>
            <div>
              <div className="eyebrow">Free · Public · Instant report</div>
              <h1 className={s.h1}>How AI-ready is your business?</h1>
              <div className={s.pill}>10 minutes · 25 questions · free</div>
              {!rateLimited ? (
                <div style={{ marginTop: 26 }}>
                  <button type="button" className={`btn btn-primary ${s.fullM}`} onClick={start} disabled={starting}>
                    {starting ? "Starting…" : "Start"}
                  </button>
                </div>
              ) : (
                <div role="alert" style={{ marginTop: 24, padding: 18, background: "#FDF4E3", border: "1px solid #B7791F", borderRadius: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>You have reached the limit for this device</div>
                  <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, maxWidth: "52ch" }}>
                    The Scorecard has been started several times from this device today. Please try again tomorrow. Your earlier answers are saved.
                  </p>
                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a className="btn btn-outline btn-sm" href={`mailto:${site.contactEmail}?subject=AI-Readiness%20Scorecard`}>Write to Amalthea</a>
                    <button type="button" className="btn btn-sm" disabled>Start (available tomorrow)</button>
                  </div>
                </div>
              )}
              <p style={{ margin: "18px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "#6B5A4D", maxWidth: "56ch" }}>
                Your answers are visible only to you and the Amalthea audit team. <a href="/privacy">Privacy notice · DPDP Act, 2023</a>
              </p>
            </div>
            <div className={s.card}>
              <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.1em" }}>What you get</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                {GETS.map(([t, d, mo]) => (
                  <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Moon phase={mo} size={24} style={{ marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 15.5, fontWeight: 800 }}>{t}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#6B5A4D", marginTop: 1 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {k === "details" && (
          <div>
            <div className="eyebrow">Step 1 of 3 · Your details</div>
            <h1 className={s.h2}>Tell us who you are</h1>
            <p className={s.sub}>We use this to send your report and to compare you with similar businesses. Nothing here is shown to anyone else.</p>
            <div className={s.fields}>
              <TextField id="name" label="Your name" ph="Kiran Mehta" auto="name" value={details.name} err={showErr ? errors.name : undefined} onChange={(v) => setDetail("name", v)} />
              <TextField id="biz" label="Business name" ph="Kavya Industrial Supplies" auto="organization" value={details.biz} err={showErr ? errors.biz : undefined} onChange={(v) => setDetail("biz", v)} />
              <SelectField id="industry" label="Industry" options={INDUSTRIES} value={details.industry} err={showErr ? errors.industry : undefined} onChange={(v) => setDetail("industry", v)} />
              <TextField id="city" label="City" ph="Rajkot" auto="address-level2" value={details.city} err={showErr ? errors.city : undefined} onChange={(v) => setDetail("city", v)} />
              <SelectField id="turnover" label="Annual turnover" options={TURNOVER_BANDS} value={details.turnover} err={showErr ? errors.turnover : undefined} onChange={(v) => setDetail("turnover", v)} />
              <SelectField id="team" label="Team size" options={TEAM_SIZES} value={details.team} err={showErr ? errors.team : undefined} onChange={(v) => setDetail("team", v)} />
              <TextField id="wa" label="WhatsApp number" ph="98765 43210" type="tel" auto="tel-national" prefix="+91" inputMode="numeric" value={details.wa} err={showErr ? errors.wa : undefined} onChange={(v) => setDetail("wa", v)} />
              <TextField id="email" label="Email" ph="name@company.in" type="email" auto="email" value={details.email} err={showErr ? errors.email : undefined} onChange={(v) => setDetail("email", v)} />
            </div>
            <div style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <button
                type="button" role="checkbox" aria-checked={details.consent} aria-labelledby="consent-label"
                className={`${s.consentBox} ${details.consent ? s.consentOn : ""} ${showErr && errors.consent ? s.consentErr : ""}`}
                onClick={() => setDetail("consent", !details.consent)}
              >
                {details.consent && <Check />}
              </button>
              <div style={{ paddingTop: 2 }}>
                <div id="consent-label" style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
                  I agree that Amalthea may contact me about my results. <a href="/privacy" target="_blank">Privacy notice</a>
                </div>
                {showErr && errors.consent && <div className="field-error" style={{ marginTop: 4 }}>{errors.consent}</div>}
              </div>
            </div>
          </div>
        )}

        {k === "pillar" && (
          <div>
            <div className={s.stepper}>
              {PILLARS.map((p, i) => {
                const done = pillarAnswers(answers, i).every((a) => a !== null);
                const active = i === screen.p;
                return (
                  <button
                    key={p.name} type="button" className={s.step} aria-label={p.name} aria-current={active ? "step" : undefined}
                    disabled={!done && !active} onClick={() => go({ k: "pillar", p: i })}
                  >
                    <svg width="30" height="30" viewBox="0 0 20 20" aria-hidden="true">
                      <circle cx="10" cy="10" r="8.5" fill="#FFFFFF" stroke={active || done ? "#C24000" : "#6B5A4D"} strokeWidth="1.4" />
                      {(done || active) && <path d={done ? MOON_PATHS[4] : MOON_PATHS[2]} fill="#F5A020" />}
                    </svg>
                    <span className={`${s.stepLabel} ${active ? s.stepLabelOn : ""}`}>
                      <span className={active ? undefined : s.onlyDesktop}>{p.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="eyebrow">Pillar {screen.p + 1} of 5</div>
            <h1 className={s.h2} style={{ marginTop: 6 }}>{PILLARS[screen.p].name}</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "#6B5A4D", maxWidth: "60ch" }}>{PILLARS[screen.p].blurb}</p>
            <div className={s.scale}>0 Never · 1 Rarely · 2 Sometimes · 3 Mostly · 4 Always</div>
            <div className={s.items}>
              {PILLARS[screen.p].statements.map((text, j) => {
                const i = screen.p * 5 + j;
                const val = answers[i];
                const missing = tried && val === null;
                return (
                  <fieldset key={i} className={`${s.item} ${missing ? s.itemMissing : ""}`} style={{ margin: 0 }}>
                    <legend className="visually-hidden">Statement {i + 1}</legend>
                    <p className={s.statement}><span style={{ color: "#6B5A4D", fontWeight: 800 }}>{i + 1}.</span> {text}</p>
                    <div className={s.chips} role="radiogroup" aria-label={`Statement ${i + 1}`}>
                      {RATING_LABELS.map((label, n) => (
                        <button
                          key={label} type="button" role="radio" aria-checked={val === n}
                          className={`${s.chip} ${val === n ? s.chipOn : ""}`} onClick={() => setAnswer(i, n as Answer)}
                        >
                          <span className={s.chipN}>{n}</span>
                          <span className={s.chipL}>{label}</span>
                        </button>
                      ))}
                    </div>
                    {missing && <div style={{ fontSize: 12.5, fontWeight: 800, color: "#C62828", marginTop: 8 }}>Pick one to continue.</div>}
                  </fieldset>
                );
              })}
            </div>
          </div>
        )}

        {k === "open" && (
          <div>
            <div className="eyebrow">Last step · 3 questions</div>
            <h1 className={s.h2}>In your own words</h1>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className={s.cardSm}>
                <label className={s.q} htmlFor="q-bottleneck">a. What is the biggest bottleneck in your business today?</label>
                <textarea
                  id="q-bottleneck" className="input" maxLength={OPEN_TEXT_MAX} value={open.bottleneck}
                  onChange={(e) => setOpenField("bottleneck", e.target.value)} style={{ marginTop: 10, minHeight: 96 }}
                />
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <VoiceButton on={dictation.active === "bottleneck"} onClick={() => toggleVoice("bottleneck")} />
                  {voice.bottleneck && <AiBadge />}
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#6B5A4D" }}>{open.bottleneck.length}/{OPEN_TEXT_MAX}</span>
                </div>
              </div>
              <fieldset className={s.cardSm} style={{ margin: 0 }}>
                <legend className="visually-hidden">Which software do you use?</legend>
                <div className={s.q} aria-hidden="true">b. Which software do you use?</div>
                <div style={{ fontSize: 12.5, color: "#6B5A4D", marginTop: 2 }}>Pick all that apply.</div>
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SOFTWARE.map((name) => {
                    const on = open.software.includes(name);
                    return (
                      <button
                        key={name} type="button" aria-pressed={on} className={`${s.sw} ${on ? s.swOn : ""}`}
                        onClick={() => {
                          let next = on ? open.software.filter((x) => x !== name) : [...open.software, name];
                          // "None" cannot sit alongside actual tools.
                          if (!on && name === "None") next = ["None"];
                          else if (!on) next = next.filter((x) => x !== "None");
                          setOpenField("software", next);
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className={s.cardSm}>
                <label className={s.q} htmlFor="q-automate">c. Name one task you would most like to automate</label>
                <textarea
                  id="q-automate" className="input" maxLength={OPEN_TEXT_MAX} value={open.automate}
                  onChange={(e) => setOpenField("automate", e.target.value)} style={{ marginTop: 10, minHeight: 76 }}
                />
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <VoiceButton on={dictation.active === "automate"} onClick={() => toggleVoice("automate")} />
                  {voice.automate && <AiBadge />}
                </div>
              </div>
            </div>
          </div>
        )}

        {k === "review" && (
          <div>
            <div className="eyebrow">Review</div>
            <h1 className={s.h2}>Check your answers</h1>
            <p className={s.sub}>
              {answered === 25
                ? "All 25 statements answered. Open a pillar to check, or edit it."
                : `${25 - answered} of 25 statements are unanswered. Tap Edit on the pillar to finish.`}
            </p>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              {PILLARS.map((p, i) => {
                const pa = pillarAnswers(answers, i);
                const n = pa.filter((a) => a !== null).length;
                const isOpen = !!revOpen[i];
                return (
                  <div key={p.name} className={s.revItem}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 4px" }}>
                      <button type="button" className={s.revHead} aria-expanded={isOpen} onClick={() => setRevOpen({ ...revOpen, [i]: !isOpen })}>
                        <Chevron size={16} style={{ transform: `rotate(${isOpen ? 180 : -90}deg)` }} />
                        <span style={{ flex: "1 1 0", minWidth: 0, fontSize: 15, fontWeight: 800 }}>{p.name}</span>
                        <span className={s.badge} style={{ background: n === 5 ? "#EAF4EB" : "#FADBD8", color: n === 5 ? "#2E7D32" : "#C62828" }}>{n} of 5 answered</span>
                      </button>
                      <button type="button" className="link-button" onClick={() => go({ k: "pillar", p: i })}>Edit</button>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "2px 16px 14px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #EADBC8" }}>
                        {p.statements.map((text, j) => {
                          const a = pa[j];
                          return (
                            <div key={j} style={{ display: "flex", gap: 10, alignItems: "baseline", paddingTop: 8 }}>
                              <span style={{ flex: "1 1 0", minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>{text}</span>
                              <span style={{ flex: "none", fontSize: 12, fontWeight: 800, color: a === null ? "#C62828" : "#241B14" }}>
                                {a === null ? "Unanswered" : `${a} ${RATING_LABELS[a]}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className={s.revItem} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Your details and 3 open answers</div>
                  <div style={{ fontSize: 12.5, color: "#6B5A4D", marginTop: 2 }}>
                    {details.biz || "Business"} · {details.city || "City"} · {open.software.length} {open.software.length === 1 ? "tool" : "tools"} selected
                  </div>
                </div>
                <button type="button" className="link-button" onClick={() => go({ k: "details" })}>Edit</button>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.5, color: "#6B5A4D" }}>Your score is calculated by fixed rules. AI only writes the explanation.</div>
          </div>
        )}

        {k === "generating" && (
          <div className={s.gen} aria-live="polite">
            <Moon phase={Math.min(4, Math.max(1, gen + 1)) as MoonPhase} size={64} strokeWidth={1.1} />
            <h1 className={s.h2} style={{ marginTop: 14 }}>{netErr ? "Something went wrong" : gen >= 4 ? "Your report is ready" : "Building your report"}</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#6B5A4D" }}>
              {netErr ? "The connection dropped before we finished." : "This takes 15–30 seconds. Please keep this page open."}
            </p>
            {!netErr ? (
              <>
                <div className={s.genList}>
                  {GEN_STEPS.map((label, i) => {
                    const done = gen > i, active = gen === i;
                    return (
                      <div key={label} className={s.genRow}>
                        <div className={`${s.dot} ${done ? s.dotDone : active ? s.dotActive : ""}`}>
                          {done && <Check size={14} />}
                          {active && <Spinner />}
                        </div>
                        <span style={{ fontSize: 15, fontWeight: done || active ? 800 : 600, color: done || active ? "#241B14" : "#6B5A4D" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: 1.55, color: "#6B5A4D" }}>Your score is calculated by fixed rules. AI only writes the explanation.</p>
              </>
            ) : (
              <div role="alert" style={{ marginTop: 22, padding: 22, background: "#FADBD8", border: "1px solid #C62828", borderRadius: 14, textAlign: "left" }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>We could not reach the server</div>
                <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6 }}>Check your internet connection. Your answers are saved. Nothing is lost.</p>
                <button type="button" className="btn btn-primary" style={{ marginTop: 14, minHeight: 48 }} onClick={() => runGeneration(gen)}>Retry</button>
              </div>
            )}
          </div>
        )}
      </main>

      {showBar && (
        <div className={s.bar}>
          <div className={s.barInner}>
            <button type="button" className="btn btn-outline" style={{ flex: "none" }} onClick={back}>Back</button>
            <button type="button" className="btn btn-primary" style={{ flex: "1 1 0" }} onClick={next}>
              {k === "details" ? "Continue" : k === "open" ? "Review answers" : k === "review" ? "Get my report" : "Next"}
            </button>
          </div>
        </div>
      )}
      {toast.node(showBar ? 84 : 22)}
    </div>
  );
}

function VoiceButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${s.voice} ${on ? s.voiceOn : ""}`} onClick={onClick} aria-pressed={on}>
      <Mic size={16} />
      {on ? "Recording… tap to stop" : "Record a voice note"}
    </button>
  );
}

function TextField(p: {
  id: string; label: string; ph: string; value: string; err?: string; onChange: (v: string) => void;
  type?: string; auto?: string; prefix?: string; inputMode?: "numeric";
}) {
  const input = (
    <input
      id={`f-${p.id}`} className="input" type={p.type ?? "text"} placeholder={p.ph} autoComplete={p.auto} inputMode={p.inputMode}
      value={p.value} onChange={(e) => p.onChange(e.target.value)} aria-invalid={!!p.err} aria-describedby={p.err ? `f-${p.id}-err` : undefined}
      style={p.prefix ? { flex: "1 1 0", minWidth: 0 } : undefined}
    />
  );
  return (
    <div>
      <label className="field-label" htmlFor={`f-${p.id}`}>{p.label}</label>
      {p.prefix ? (
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ flex: "none", minHeight: 48, display: "flex", alignItems: "center", padding: "0 12px", background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 10, fontSize: 15, fontWeight: 800 }}>{p.prefix}</span>
          {input}
        </div>
      ) : input}
      {p.err && <div id={`f-${p.id}-err`} className="field-error">{p.err}</div>}
    </div>
  );
}

function SelectField(p: { id: string; label: string; options: readonly string[]; value: string; err?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label" htmlFor={`f-${p.id}`}>{p.label}</label>
      <select
        id={`f-${p.id}`} className="input" value={p.value} onChange={(e) => p.onChange(e.target.value)}
        aria-invalid={!!p.err} aria-describedby={p.err ? `f-${p.id}-err` : undefined}
      >
        <option value="">Select</option>
        {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {p.err && <div id={`f-${p.id}-err`} className="field-error">{p.err}</div>}
    </div>
  );
}
