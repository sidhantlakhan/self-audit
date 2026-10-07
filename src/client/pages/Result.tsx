import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banner, BAND_COLOR, BandMoon, Bar, Gauge, Loading, Logo, Page, Spinner } from '../components/ui.tsx';
import { api, ApiError } from '../lib/api.ts';
import { forgetToken, getToken } from '../lib/storage.ts';
import { consumeHashToken } from '../lib/session.ts';
import { ResumeRequest } from './Resume.tsx';

interface Analysis {
  executive_assessment: string; readiness_interpretation: string;
  dimension_insights: { dimension: string; insight: string }[];
  key_readiness_gaps: { title: string; evidence: string; why_it_matters: string }[];
  founder_dependency_insight: string;
  ai_opportunity_areas: { area: string; rationale: string; readiness_note: string }[];
  business_context_observations: string[]; consultation_focus_areas: string[];
}
interface Result {
  id: string; respondent: string; business: string; analysisStatus: string; reportStatus: string; consultationStatus: string; bookingUrl: string | null;
  score: {
    overall: number; band: { id: string; label: string; summary: string }; bands: { id: string; label: string; min: number; max: number }[];
    dimensions: { id: string; label: string; short: string; description: string; score: number; weight: number }[];
    founderDependency: { level: string; label: string; signals: string[] };
    opportunity: { level: string; label: string; areas: { id: string; label: string; strength: string; sources: string[] }[]; priorityOutcomes: string[] };
    adoptionIntent: { rating: number | null; label: string };
    profile: { key: string; label: string };
    lowestAreas: { id: string; label: string; score: number }[]; weakestAnswers: { id: string; label: string; score: number }[];
  };
  analysis: Analysis | null;
}

const AI = () => <span className="badge-ai">Drafted by AI</span>;
const STRENGTH: Record<string, string> = { strong: 'Strong signal', moderate: 'Moderate signal', emerging: 'Emerging signal' };
const FD_TAG: Record<string, string> = { low: 'green', moderate: '', high: 'red', very_high: 'red' };

export function ResultPage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<Result | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'error' | 'incomplete'>('loading');
  const [msg, setMsg] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const started = useRef(Date.now());

  const fetchResult = useCallback(async () => {
    try {
      const r = await api<Result>(`/api/assessments/${id}/result`, { token: token.current });
      setData(r); setState('ready');
      return r;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { forgetToken(id); setState('invalid'); }
      else if (e instanceof ApiError && e.status === 409) setState('incomplete');
      else setState((s) => (s === 'ready' ? s : 'error'));
      return null;
    }
  }, [id]);

  useEffect(() => {
    consumeHashToken(id);
    token.current = getToken(id);
    if (!token.current) { setState('invalid'); return; }
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await fetchResult();
      if (stop) return;
      const pending = r && (['pending', 'processing'].includes(r.analysisStatus) || ['pending', 'processing', 'not_started'].includes(r.reportStatus) && r.analysisStatus !== 'failed');
      if (pending) timer = setTimeout(tick, Date.now() - started.current < 120_000 ? 3000 : 15_000);
    };
    void tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [id, fetchResult]);

  if (state === 'loading') return <Loading message="Preparing your diagnostic…" />;
  if (state === 'invalid') return <ResumeRequest reason="invalid" />;
  if (state === 'incomplete') return <Page><div className="center"><div className="inner"><h1>Your assessment is not complete yet</h1><p className="muted">Finish the remaining questions to see your diagnostic.</p><Link className="btn btn-primary" to={`/a/${id}`}>Continue assessment</Link></div></div></Page>;
  if (state === 'error' || !data) return <Page><div className="center"><div className="inner"><h1>We couldn’t load your diagnostic</h1><p className="muted">Please check your connection and try again.</p><button className="btn btn-primary" onClick={() => { setState('loading'); void fetchResult(); }}>Try again</button></div></div></Page>;

  const d = data, s = d.score, a = d.analysis;
  const insight = (dim: string) => a?.dimension_insights.find((x) => x.dimension === dim)?.insight;
  const analysisPending = !a && d.analysisStatus !== 'failed';
  const booked = d.consultationStatus === 'booked';

  async function book() { await api(`/api/assessments/${id}/consultation`, { method: 'POST', token: token.current, body: {}, keepalive: true }).catch(() => undefined); setData((x) => (x && x.consultationStatus === 'none' ? { ...x, consultationStatus: 'clicked' } : x)); }
  async function download() {
    setMsg(null);
    try {
      const res = await fetch(`/api/assessments/${id}/report`, { headers: { Authorization: `Bearer ${token.current}` } });
      if (res.status === 409) { setMsg('Your assessment is complete. Your report is being prepared.'); void fetchResult(); return; }
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `AI-Readiness-Diagnostic-${d.business.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setMsg('We could not download the report just now. Please try again in a moment.'); }
  }

  const BookCta = ({ size = '', block = false }: { size?: string; block?: boolean }) => booked
    ? <div className="banner ok" style={{ color: 'var(--ink)' }}><b>Consultation booked.</b> You will receive confirmation from the booking service.</div>
    : d.bookingUrl
      ? <a className={`btn btn-amber ${size} ${block ? 'btn-block' : ''}`} href={d.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={book}>Book Consultation</a>
      : <p className="muted">Consultation booking is not available right now.</p>;

  return (
    <Page header={<header className="ahead"><div className="wrap"><Logo /></div></header>}>
      <div className="result-pad">
        <section className="result-hero">
          <div className="wrap">
            <div className="eyebrow" style={{ color: 'var(--amber)' }}>Your diagnostic is ready</div>
            <h1 style={{ marginTop: 6 }}>{d.business}</h1>
            <div className="score-grid">
              <div className="score-card">
                <Gauge score={s.overall} band={s.band.id} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="eyebrow">Current AI readiness</div>
                  <div className="band" style={{ color: BAND_COLOR[s.band.id] }}><BandMoon band={s.band.id} size={34} /> {s.band.label}</div>
                  <p className="muted" style={{ marginTop: 6 }}>{s.band.summary}</p>
                </div>
                <div className="bandscale" role="img" aria-label={`Readiness bands: ${s.bands.map((b) => `${b.label} ${b.min} to ${b.max}`).join(', ')}. You are in ${s.band.label}.`}>
                  {s.bands.map((b) => <div key={b.id} className={b.id === s.band.id ? 'on' : ''}>{b.label}<br /><span style={{ fontWeight: 600 }}>{b.min}–{b.max}</span></div>)}
                </div>
              </div>
              <div style={{ color: 'var(--line)' }}>
                <div className="eyebrow" style={{ color: 'var(--amber)' }}>Executive assessment {a && <AI />}</div>
                {a ? <p style={{ marginTop: 10, fontSize: 18, color: '#fff', lineHeight: 1.6 }}>{a.executive_assessment}</p> : (
                  <div style={{ marginTop: 12 }}>
                    {analysisPending ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Spinner /><span>Your assessment has been completed. We are preparing your detailed interpretation.</span></div> : <p>Your assessment has been completed. We are preparing your detailed interpretation.</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="wrap" style={{ paddingBottom: 56 }}>
          <section className="block panel" aria-labelledby="h-dims">
            <h2 id="h-dims">Dimension scores</h2>
            <p className="muted" style={{ marginTop: 4 }}>Each dimension is scored out of 100 by fixed rules. They are combined into your overall score.</p>
            <div style={{ marginTop: 8 }}>
              {s.dimensions.map((x) => (
                <div key={x.id} className={`dimrow ${x.score < 50 ? 'weak' : ''}`}>
                  <div className="h"><b>{x.label}</b><span className="tnum">{x.score}<small className="muted" style={{ fontWeight: 700 }}> / 100</small></span></div>
                  <Bar value={x.score} color={x.score < 50 ? 'linear-gradient(90deg,#E8650A,#C62828)' : undefined} />
                  <p className="small" style={{ color: insight(x.id) ? 'var(--ink)' : 'var(--muted)', marginTop: 2 }}>{insight(x.id) ?? x.description}{insight(x.id) && <> <AI /></>}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="block" aria-labelledby="h-gaps">
            <h2 id="h-gaps">Key readiness gaps {a && <AI />}</h2>
            {a ? (
              <div className="gaps">
                {a.key_readiness_gaps.map((g, i) => (
                  <article key={i} className="gap"><div className="n">{i + 1}</div><div><h3>{g.title}</h3><p><b>Evidence.</b> {g.evidence}</p><p><b>Why it matters.</b> {g.why_it_matters}</p></div></article>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                <Banner kind="info">{analysisPending ? 'Your assessment has been completed. We are preparing your detailed interpretation.' : 'Your assessment has been completed. We are preparing your detailed interpretation.'} In the meantime, these are the lowest-scoring areas from your answers:</Banner>
                <div className="gaps">
                  {s.lowestAreas.map((l, i) => <article key={l.id} className="gap"><div className="n">{i + 1}</div><div><h3>{l.label}</h3><p>Scored {l.score} out of 100 — among the lowest of the five dimensions.</p></div></article>)}
                </div>
              </div>
            )}
          </section>

          <section className="block" aria-labelledby="h-opp">
            <h2 id="h-opp">Potential AI opportunity areas {a && <AI />}</h2>
            <p className="muted" style={{ marginTop: 4, maxWidth: '70ch' }}>Opportunity is assessed separately from readiness. It shows where AI appears relevant to your business, based on what you told us — not what to do about it.</p>
            <div className="twocol" style={{ marginTop: 14 }}>
              <div className="panel"><div className="eyebrow">Readiness</div><div style={{ fontSize: 30, fontWeight: 800, color: BAND_COLOR[s.band.id] }}>{s.overall}<small className="muted" style={{ fontSize: 15 }}> / 100 · {s.band.label}</small></div></div>
              <div className="panel"><div className="eyebrow">Opportunity relevance</div><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--deep)' }}>{s.opportunity.label.replace(' relevance', '')}</div><div className="small muted">{s.profile.label}</div></div>
            </div>
            <div className="twocol">
              {(a?.ai_opportunity_areas.length ? a.ai_opportunity_areas : s.opportunity.areas.slice(0, 4).map((o) => ({ area: o.label, rationale: `Signalled through: ${o.sources.join('; ')}.`, readiness_note: '' }))).map((o) => {
                const sig = s.opportunity.areas.find((x) => x.label.toLowerCase() === o.area.toLowerCase());
                return <article key={o.area} className="opp"><h3>{o.area} {sig && <span className="tag">{STRENGTH[sig.strength]}</span>}</h3><p>{o.rationale}</p>{o.readiness_note && <p className="muted"><b>Readiness note.</b> {o.readiness_note}</p>}</article>;
              })}
              {!s.opportunity.areas.length && !a?.ai_opportunity_areas.length && <p className="muted">Your answers did not signal specific opportunity areas.</p>}
            </div>
            <p className="small" style={{ marginTop: 16 }}><b>AI adoption intent</b> <span className="muted">(what you told us — not a readiness measure):</span> {s.adoptionIntent.label}{s.adoptionIntent.rating ? ` (${s.adoptionIntent.rating} of 5)` : ''}</p>
          </section>

          <section className="block panel" aria-labelledby="h-fd">
            <h2 id="h-fd">Founder dependency <span className={`tag ${FD_TAG[s.founderDependency.level]}`}>{s.founderDependency.label}</span> {a && <AI />}</h2>
            {a ? <p style={{ marginTop: 12 }}>{a.founder_dependency_insight}</p> : <p className="muted" style={{ marginTop: 12 }}>Your detailed interpretation is being prepared. These are the patterns your answers show:</p>}
            {s.founderDependency.signals.length > 0 && <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>{s.founderDependency.signals.map((x) => <li key={x}>{x}</li>)}</ul>}
          </section>

          {a && (
            <section className="block panel" aria-labelledby="h-obs">
              <h2 id="h-obs">Business-specific observations <AI /></h2>
              <ul style={{ margin: '12px 0 0', paddingLeft: 20, display: 'grid', gap: 8 }}>{a.business_context_observations.map((o) => <li key={o}>{o}</li>)}</ul>
            </section>
          )}

          <section className="cta-panel" aria-labelledby="h-cta">
            <div style={{ flex: '1 1 320px' }}>
              <h2 id="h-cta">Discuss your diagnostic</h2>
              <p>This diagnostic describes where your business stands. What it means in practice, and what to do about it, is discussed in a consultation.</p>
              {a && a.consultation_focus_areas.length > 0 && <ul style={{ margin: '14px 0 0', paddingLeft: 20, color: 'var(--line)' }}>{a.consultation_focus_areas.map((f) => <li key={f}>{f}</li>)}</ul>}
            </div>
            <div className="cta-actions">
              <BookCta size="btn-lg" />
              <button className="btn btn-dark-ghost" onClick={download}>{d.reportStatus === 'complete' ? 'Download your report (PDF)' : 'Report is being prepared…'}</button>
            </div>
          </section>
          {msg && <div style={{ marginTop: 14 }}><Banner kind="info">{msg}</Banner></div>}
          {d.reportStatus !== 'complete' && a && <p className="small muted" style={{ marginTop: 12 }}>Your assessment is complete. Your report is being prepared.</p>}
        </div>
      </div>
      {!booked && d.bookingUrl && <div className="sticky-book"><BookCta block /></div>}
    </Page>
  );
}
