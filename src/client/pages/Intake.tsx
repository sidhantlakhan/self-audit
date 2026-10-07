import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banner, Logo, Moon, Page, Spinner } from '../components/ui.tsx';
import { api, ApiError } from '../lib/api.ts';
import { readAttribution } from '../lib/attribution.ts';
import { forgetToken, getToken, lastAssessmentId, saveToken } from '../lib/storage.ts';

interface Existing { id: string; locked: boolean; completionPercentage: number }

export function Intake() {
  const nav = useNavigate();
  const [existing, setExisting] = useState<Existing | null>(null);
  const [checking, setChecking] = useState(true);
  const [consent, setConsent] = useState(false);
  const [consentErr, setConsentErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    const id = lastAssessmentId();
    if (!id) { setChecking(false); return; }
    api(`/api/assessments/${id}`, { token: getToken(id) })
      .then((s) => setExisting({ id, locked: s.locked, completionPercentage: s.completionPercentage }))
      .catch((e) => { if (e instanceof ApiError && e.status === 401) forgetToken(id); })
      .finally(() => setChecking(false));
  }, []);

  async function start() {
    if (!consent) { setConsentErr(true); return; }
    setBusy(true); setError(null);
    const a = readAttribution();
    try {
      const r = await api<{ id: string; token: string }>('/api/assessments', {
        method: 'POST',
        body: { consent: true, visitorId: a?.visitorId, firstTouch: a?.firstTouch, latestTouch: a?.latestTouch, landingUrl: a?.landingUrl, referrer: a?.referrer },
      });
      saveToken(r.id, r.token);
      nav(`/a/${r.id}/phase/1`);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? 'You have started several assessments from this device. Please try again later, or continue an earlier one.' : e instanceof ApiError && e.isNetwork ? 'We could not reach the server. Please check your connection and try again.' : 'We could not start the assessment. Please try again.');
      setBusy(false);
    }
  }

  const showResume = existing && !fresh;
  return (
    <Page header={<header className="topbar"><div className="wrap"><Logo /></div></header>}>
      <div className="wrap narrow" style={{ padding: 'clamp(28px,5vw,64px) var(--gutter)' }}>
        {checking ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Spinner /> <span className="muted">One moment…</span></div> : (
          <>
            {showResume && (
              <Banner kind="info" action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-primary btn-sm" to={existing.locked ? `/a/${existing.id}/result` : `/a/${existing.id}`}>{existing.locked ? 'View your diagnostic' : 'Continue'}</Link>
                <button className="btn btn-ghost btn-sm" onClick={() => setFresh(true)}>Start a new one</button>
              </div>}>
                <b>{existing.locked ? 'You have a completed diagnostic on this device.' : `Pick up where you left off — ${existing.completionPercentage}% complete.`}</b>
              </Banner>
            )}
            <div className="eyebrow" style={{ marginTop: showResume ? 28 : 0 }}>AI Readiness Diagnostic</div>
            <h1 style={{ fontSize: 'clamp(30px,5vw,46px)', color: 'var(--deep)', fontWeight: 800, marginTop: 8, lineHeight: 1.1 }}>How AI-ready is your business?</h1>
            <p style={{ marginTop: 14, fontSize: 18, color: 'var(--muted)', maxWidth: '58ch' }}>A structured business assessment in six short phases. It takes about 8–10 minutes.</p>

            <div className="panel" style={{ marginTop: 26 }}>
              <h2 style={{ fontSize: 19, fontWeight: 800 }}>What to expect</h2>
              <ul style={{ margin: '12px 0 0', paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
                {['Business context, then ownership, processes, data and systems, people and controls, and AI opportunity.', 'Mostly selections and ratings, with a few short written answers. Dictation is optional.', 'Your progress saves automatically. You can close the browser and resume later with a secure link.', 'You will see your score, dimension-level assessment, gaps and opportunity areas straight away.'].map((t, i) => (
                  <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><Moon size={22} fraction={[0.2, 0.45, 0.7, 1][i]} /><span>{t}</span></li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 14 }}>Free · No card needed · Your data stays private.</p>

              <div className={consentErr && !consent ? 'has-error' : ''} style={{ marginTop: 22 }}>
                <label className="opt" style={{ display: 'block' }}>
                  <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setConsentErr(false); }} aria-describedby="consent-err" />
                  <span className="box" style={{ alignItems: 'flex-start' }}>
                    <span className="mark check" style={{ marginTop: 2 }}><svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <span>I have read the <Link to="/privacy" target="_blank" style={{ position: 'relative', zIndex: 2 }}>privacy notice</Link> and agree that my answers may be processed to produce my diagnostic, including by an AI service that does not receive my name or contact details.</span>
                  </span>
                </label>
                {consentErr && !consent && <p className="err" id="consent-err" role="alert" style={{ marginTop: 8 }}>Please agree to continue.</p>}
              </div>

              {error && <div style={{ marginTop: 16 }}><Banner kind="error">{error}</Banner></div>}
              <div style={{ marginTop: 22, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Begin assessment'}</button>
                <Link to="/resume" className="small" style={{ fontWeight: 700 }}>Already started? Continue with your email and mobile</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
