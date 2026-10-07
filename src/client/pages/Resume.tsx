import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner, Logo, Page } from '../components/ui.tsx';
import { api, ApiError } from '../lib/api.ts';

export function ResumeRequest({ reason }: { reason?: 'invalid' | 'expired' }) {
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api('/api/resume', { method: 'POST', body: { email: email.trim(), mobile: mobile.trim() } }); setSent(true); }
    catch (err) { setError(err instanceof ApiError && err.status === 429 ? 'Too many requests. Please try again in a while.' : err instanceof ApiError && err.status === 400 ? 'Please enter a valid email address and mobile number.' : 'We could not send the link. Please check your connection and try again.'); }
    finally { setBusy(false); }
  }

  return (
    <Page header={<header className="topbar"><div className="wrap"><Logo /></div></header>}>
      <div className="wrap narrow" style={{ padding: 'clamp(28px,5vw,64px) var(--gutter)' }}>
        {reason === 'invalid' && <h1 style={{ fontSize: 'clamp(26px,4vw,36px)', color: 'var(--deep)' }}>This assessment link is no longer valid.</h1>}
        {!reason && <h1 style={{ fontSize: 'clamp(26px,4vw,36px)', color: 'var(--deep)' }}>Continue your assessment</h1>}
        <p className="muted" style={{ marginTop: 10, fontSize: 17 }}>{reason === 'invalid' ? 'The link may have expired or been replaced. Enter the email address and mobile number you used and we will send a new link.' : 'Enter the email address and mobile number you used. We will email you a secure link to continue where you left off.'}</p>
        <div className="panel" style={{ marginTop: 22 }}>
          {sent ? <Banner kind="ok"><b>If an assessment matches these details, a link has been sent to that email address.</b> It may take a minute to arrive. Check your spam folder if you do not see it.</Banner> : (
            <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 18 }}>
              <div className="field"><label htmlFor="r-email">Email address</label><input id="r-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="field"><label htmlFor="r-mobile">Mobile number</label><input id="r-mobile" className="input" type="tel" autoComplete="tel" placeholder="98765 43210" value={mobile} onChange={(e) => setMobile(e.target.value)} required /></div>
              {error && <Banner kind="error">{error}</Banner>}
              <div><button className="btn btn-primary" disabled={busy || !email || !mobile}>{busy ? 'Sending…' : 'Email me a link'}</button></div>
            </form>
          )}
        </div>
        <p style={{ marginTop: 24 }}>Prefer to begin again? <Link to="/assessment" style={{ fontWeight: 800 }}>Start a new assessment</Link></p>
      </div>
    </Page>
  );
}
