import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import type { Answer } from '../../shared/types.ts';
import { isVisible } from '../../shared/validation.ts';
import { Banner, Check, Loading, Logo, Moon, Page } from '../components/ui.tsx';
import { Field, type QDef } from '../components/fields.tsx';
import { useAssessmentSession, type Session } from '../lib/session.ts';
import { ResumeRequest } from './Resume.tsx';

const NETWORK_MSG = 'We couldn’t save your response. Please check your connection and try again.';

function SaveIndicator({ s }: { s: Session }) {
  if (s.save === 'idle') return <span className="saved" style={{ visibility: 'hidden' }}>Saved</span>;
  if (s.save === 'saving') return <span className="saved saving" role="status">Saving…</span>;
  if (s.save === 'error') return <span className="saved error" role="status">Not saved <button className="linkbtn" style={{ minHeight: 0, color: 'inherit', marginLeft: 4 }} onClick={s.retryNow}>Retry</button></span>;
  return <span className="saved" role="status"><Check size={12} color="#2E7D32" /> Saved</span>;
}

function Shell({ s, children }: { s: Session; children: React.ReactNode }) {
  return (
    <Page header={<header className="ahead"><div className="wrap"><Logo /><span className="spacer" /><SaveIndicator s={s} /></div></header>}>
      <div className="wrap narrow" style={{ maxWidth: 820 }}>{children}</div>
    </Page>
  );
}

function Progress({ s, phase }: { s: Session; phase: number | 'review' }) {
  const phases = s.state!.config.phases;
  const cur = phase === 'review' ? null : phases.find((p) => p.number === phase)!;
  return (
    <div className="progress">
      <div className="meta">
        <div>
          <div className="phase">{cur ? `Phase ${cur.number} of ${phases.length}` : 'Final step'}</div>
          <h1>{cur ? cur.title : 'Review your answers'}</h1>
        </div>
        <div className="small muted tnum" aria-label={`Overall progress ${s.pct} percent`}><b>{s.pct}%</b> complete</div>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress"><i style={{ width: `${s.pct}%` }} /></div>
      <nav className="stepper" aria-label="Assessment phases">
        {phases.map((p) => {
          const done = s.state!.completedPhases.includes(p.number);
          const isCur = p.number === phase;
          return (
            <Link key={p.number} to={`/a/${s.state!.id}/phase/${p.number}`} className={isCur ? 'cur' : done ? 'done' : ''} aria-current={isCur ? 'step' : undefined}>
              <Moon size={18} fraction={done ? 1 : isCur ? 0.5 : 0} /> <span>{p.number}</span><span className="sr-only">{p.title}{done ? ', completed' : ''}</span>
            </Link>
          );
        })}
        <Link to={`/a/${s.state!.id}/review`} className={phase === 'review' ? 'cur' : ''} aria-current={phase === 'review' ? 'step' : undefined}><span>Review</span></Link>
      </nav>
    </div>
  );
}

function PhasePage({ s }: { s: Session }) {
  const { n } = useParams();
  const phase = Number(n);
  const nav = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const phases = s.state!.config.phases;
  const def = phases.find((p) => p.number === phase);
  const questions = useMemo(() => s.state!.config.questions.filter((q) => q.phase === phase), [s.state, phase]);

  useEffect(() => { if (def) s.setCurrentPhase(phase); setErrors({}); setBanner(null); window.scrollTo({ top: 0 }); top.current?.focus({ preventScroll: true }); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Re-validate live once the respondent has seen errors, so messages clear as they fix them.
    if (Object.keys(errors).length) { const live = s.phaseErrors(phase); setErrors((prev) => Object.fromEntries(Object.keys(prev).filter((k) => live[k]).map((k) => [k, live[k]]))); }
  }, [s.answers]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) return <Navigate to={`/a/${s.state!.id}`} replace />;

  const focusFirst = (errs: Record<string, string>) => {
    const first = questions.find((q) => errs[q.id]);
    if (first) { const el = document.getElementById(`card-${first.id}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); (document.getElementById(`in-${first.id}`) ?? el?.querySelector<HTMLElement>('input,button'))?.focus({ preventScroll: true }); }
  };

  async function next() {
    setBanner(null);
    const errs = s.phaseErrors(phase);
    if (Object.keys(errs).length) { setErrors(errs); setBanner('Please answer the highlighted questions to continue.'); focusFirst(errs); return; }
    setBusy(true);
    const r = await s.completePhase(phase);
    setBusy(false);
    if (r.ok) nav(phase >= phases.length ? `/a/${s.state!.id}/review` : `/a/${s.state!.id}/phase/${phase + 1}`);
    else if (r.errors) { setErrors(r.errors); setBanner(r.message ?? 'Please check the highlighted answers.'); focusFirst(r.errors); }
    else setBanner(NETWORK_MSG);
  }

  async function back() {
    await s.flush();
    nav(phase > 1 ? `/a/${s.state!.id}/phase/${phase - 1}` : '/assessment');
  }

  return (
    <Shell s={s}>
      <div ref={top} tabIndex={-1} style={{ outline: 'none' }} />
      <Progress s={s} phase={phase} />
      <p className="muted" style={{ marginTop: 6 }}>{def.intro}</p>
      {banner && <div style={{ marginTop: 16 }}><Banner kind="error">{banner}</Banner></div>}
      {s.save === 'error' && !banner && <div style={{ marginTop: 16 }}><Banner kind="error" action={<button className="btn btn-sm btn-ghost" onClick={s.retryNow}>Retry</button>}>{NETWORK_MSG}</Banner></div>}
      {questions.filter((q) => isVisible(q as never, s.answers)).map((q: QDef, i) => {
        const err = errors[q.id];
        const describedBy = `d-${q.id}`;
        const Wrapper = q.type === 'single_select' || q.type === 'multi_select' || q.type === 'rating' || q.type === 'ranking' ? 'fieldset' : 'div';
        return (
          <section key={q.id} id={`card-${q.id}`} className={`qcard ${err ? 'has-error' : ''}`}>
            <Wrapper className={`field ${err ? 'has-error' : ''}`}>
              <div className="qnum">QUESTION {i + 1} OF {questions.length}{!q.required && <span className="muted" style={{ fontWeight: 700, letterSpacing: 0 }}> · Optional</span>}</div>
              {Wrapper === 'fieldset'
                ? <legend id={`lbl-${q.id}`} className="qlabel">{q.label}</legend>
                : <label id={`lbl-${q.id}`} htmlFor={`in-${q.id}`} className="qlabel">{q.label}</label>}
              <div id={describedBy}>
                {q.description && <div className="qdesc">{q.description}</div>}
                {q.helpText && <div className="hint">{q.helpText}</div>}
              </div>
              <Field q={q} value={s.answers[q.id]} onChange={(v: Answer) => s.setAnswer(q.id, v)} error={err} describedBy={describedBy} />
              {err && <p className="err" role="alert">⚠ {err}</p>}
            </Wrapper>
          </section>
        );
      })}
      <div className="nav">
        <button className="btn btn-ghost" onClick={back}>← {phase > 1 ? 'Back' : 'Intro'}</button>
        <button className="btn btn-primary btn-lg" onClick={next} disabled={busy}>{busy ? 'Saving…' : phase >= phases.length ? 'Review answers →' : `Continue to phase ${phase + 1} →`}</button>
      </div>
      <p className="hint" style={{ marginTop: -36, marginBottom: 56, textAlign: 'center' }}>Your answers save automatically. You can return at any time with your link.</p>
    </Shell>
  );
}

function formatAnswer(q: QDef, v: Answer | undefined): string | null {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
  if (q.type === 'ranking') return (v as string[]).map((x, i) => `${i + 1}. ${x}`).join('   ');
  if (q.type === 'rating') return `${v} of 5`;
  return Array.isArray(v) ? v.join(', ') : String(v);
}

function ReviewPage({ s }: { s: Session }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { s.setCurrentPhase(7); void s.flush(); window.scrollTo({ top: 0 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = s.state!.config;
  const all = { ...s.allErrors(), ...errors };
  const missingTotal = Object.keys(s.allErrors()).length;

  async function complete() {
    setBanner(null);
    if (missingTotal) { setBanner('Some required questions are unanswered. Use Edit to complete them.'); return; }
    setBusy(true);
    const r = await s.completeAssessment();
    setBusy(false);
    if (r.ok) nav(`/a/${s.state!.id}/result`);
    else if (r.errors) { setErrors(r.errors); setBanner(r.message ?? 'The assessment is incomplete.'); }
    else setBanner(NETWORK_MSG);
  }

  return (
    <Shell s={s}>
      <Progress s={s} phase="review" />
      <p className="muted" style={{ marginTop: 6 }}>Check your answers. Once you complete the assessment, your responses are fixed and used to calculate your score.</p>
      {banner && <div style={{ marginTop: 16 }}><Banner kind="error">{banner}</Banner></div>}
      {missingTotal > 0 && <div style={{ marginTop: 16 }}><Banner kind="info"><b>{missingTotal} required question{missingTotal === 1 ? '' : 's'} still to answer.</b> They are marked below.</Banner></div>}
      {cfg.phases.map((p) => {
        const qs = cfg.questions.filter((q) => q.phase === p.number);
        const missing = qs.filter((q) => all[q.id]);
        return (
          <details key={p.number} className="review-phase" open={missing.length > 0}>
            <summary>
              <Moon size={22} fraction={missing.length ? 0 : 1} /><span>Phase {p.number} · {p.title}</span>
              <span className={`status ${missing.length ? 'todo' : 'ok'}`}>{missing.length ? `${missing.length} to answer` : 'Complete'}</span>
            </summary>
            <dl>
              {qs.map((q) => {
                const a = formatAnswer(q, s.answers[q.id]);
                return <div key={q.id}><dt>{q.label}</dt><dd className={a ? '' : all[q.id] ? 'missing' : ''}>{a ?? (q.required ? 'Not answered' : 'Skipped (optional)')}</dd></div>;
              })}
              <div><Link className="btn btn-ghost btn-sm" to={`/a/${s.state!.id}/phase/${p.number}`}>Edit phase {p.number}</Link></div>
            </dl>
          </details>
        );
      })}
      <div className="nav">
        <Link className="btn btn-ghost" to={`/a/${s.state!.id}/phase/${cfg.phases.length}`}>← Back</Link>
        <button className="btn btn-primary btn-lg" onClick={complete} disabled={busy}>{busy ? 'Calculating…' : 'Complete Assessment'}</button>
      </div>
    </Shell>
  );
}

function Gate({ s }: { s: Session }) {
  const st = s.state!;
  if (st.locked) return <Navigate to={`/a/${st.id}/result`} replace />;
  const phases = st.config.phases.length;
  return <Navigate to={st.currentPhase > phases ? `/a/${st.id}/review` : `/a/${st.id}/phase/${Math.max(1, st.currentPhase)}`} replace />;
}

export function AssessmentApp() {
  const { id = '' } = useParams();
  const s = useAssessmentSession(id);
  if (s.load === 'loading') return <Loading message="Loading your assessment…" />;
  if (s.load === 'invalid') return <ResumeRequest reason="invalid" />;
  if (s.load === 'no-token') return <ResumeRequest reason="expired" />;
  if (s.load === 'error') return (
    <Page header={<div className="topbar"><div className="wrap"><Logo /></div></div>}>
      <div className="center"><div className="inner"><h1>We couldn’t load your assessment</h1><p className="muted">Please check your connection and try again. Your answers are safe.</p><button className="btn btn-primary" onClick={s.reload}>Try again</button></div></div>
    </Page>
  );
  if (s.state!.locked) return <Navigate to={`/a/${id}/result`} replace />;
  return (
    <Routes>
      <Route index element={<Gate s={s} />} />
      <Route path="phase/:n" element={<PhasePage s={s} />} />
      <Route path="review" element={<ReviewPage s={s} />} />
      <Route path="*" element={<Navigate to={`/a/${id}`} replace />} />
    </Routes>
  );
}
