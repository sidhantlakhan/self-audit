import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BandMoon, Bar, Check, Logo, Moon } from '../components/ui.tsx';
import { trackEvent } from '../lib/track.ts';

const CTA = 'Take the 10-minute Scorecard';

const DIMENSIONS = [
  { name: 'Ownership & Decision Making', line: 'Clear owners and decision rights. Without them, AI has no rule to follow and no one accountable for its output.' },
  { name: 'Processes & Workflows', line: 'Work that is defined, followed and consistent. AI can only speed up a process that exists.' },
  { name: 'Data, Systems & Technology', line: 'Information that is captured once, accurate, current and connected. AI reads whatever data it is given.' },
  { name: 'People, Controls & Governance', line: 'Teams that adopt new tools, with rules on data sharing, access and review of AI output.' },
  { name: 'Performance & Business Control', line: 'Visibility of results, owned metrics and dependable reporting — so you can tell whether anything is working.' },
];

const FAQ = [
  ['How long does it take?', 'About 8–10 minutes. The assessment has six short phases and mixes selections, ratings and a few short written answers. Your progress is saved automatically, so you can stop and continue later.'],
  ['Who should fill it in?', 'The founder, CEO or a senior leader who knows how the business actually runs. Several questions ask how much depends on you, so the answers are most accurate coming from the top.'],
  ['Is my data safe?', 'Your answers are visible only to you and the diagnostic team. They are stored in a protected database and are not published or sold. The AI interpretation receives your answers without your name, contact details or business name. The privacy notice explains exactly what is collected and why.'],
  ['Do I need to use any software or AI tools already?', 'No. The diagnostic measures the foundations of the business, not how much AI you use. Current AI usage is recorded for context and does not raise or lower your score.'],
  ['What does the diagnostic not do?', 'It does not recommend tools, vendors or an implementation plan, and it does not promise results. It describes where the business stands and where AI appears relevant. What to do about it is a conversation for a consultation.'],
  ['What happens after I finish?', 'You see your score, dimension-level assessment, readiness gaps and potential AI opportunity areas immediately, and can download a diagnostic report. If you want to discuss the findings, you can book a consultation.'],
];

function useSticky() {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOn(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, on };
}

export function Landing() {
  const { ref, on } = useSticky();
  useEffect(() => { trackEvent('landing_view'); }, []);
  const cta = (location: string) => () => trackEvent('cta_clicked', { location });

  return (
    <div>
      <a href="#why" className="skip">Skip to content</a>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <nav aria-label="Primary">
            <a className="hide-sm" href="#why">Why it matters</a>
            <a className="hide-sm" href="#dimensions">Dimensions</a>
            <a className="hide-sm" href="#assessment">The assessment</a>
            <a className="hide-sm" href="#faq">FAQ</a>
            <Link className={`btn btn-primary btn-sm ${on ? 'highlight' : ''}`} to="/assessment" onClick={cta('topbar')}>{CTA}</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" ref={ref}>
          <div className="wrap hero-grid">
            <div>
              <div className="eyebrow">AI readiness diagnostic · 10 minutes</div>
              <h1>Is your business ready for AI?</h1>
              <p className="lead">Most conversations about AI start with tools. This diagnostic starts with the business: whether the foundations are in place for AI to work reliably.</p>
              <div className="cta-row">
                <Link className="btn btn-amber btn-lg" to="/assessment" onClick={cta('hero')}>{CTA}</Link>
                <p className="trust">Free · No card needed · Your data stays private.</p>
              </div>
              <p style={{ marginTop: 18 }}><Link to="/resume" style={{ color: '#F5A020', fontWeight: 700 }}>Already started? Continue your assessment</Link></p>
            </div>
            <div className="preview" aria-label="Illustrative example of a diagnostic result">
              <div className="preview-head"><span>Example business · Manufacturing</span><span className="pill">Illustrative example</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, color: '#241B14' }}>38<span style={{ fontSize: 18, color: '#6B5A4D', fontWeight: 700 }}> /100</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 800, color: 'var(--band-emerging)' }}><BandMoon band="emerging" /> Emerging</div>
              </div>
              <div style={{ marginTop: 16, display: 'grid', gap: 9 }}>
                {[['Ownership', 34], ['Processes', 29], ['Data & Systems', 24], ['People & Controls', 52], ['Performance', 46]].map(([n, v]) => (
                  <div key={n as string} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 28px', gap: 10, alignItems: 'center', fontSize: 12.5, fontWeight: 700 }}>
                    <span>{n}</span><Bar value={v as number} /><span style={{ textAlign: 'right', color: '#C24000', fontWeight: 800 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, border: '1px solid #EADBC8', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 3, background: 'var(--bad)' }} />
                <div style={{ padding: '12px 14px' }}>
                  <span className="badge-ai">Drafted by AI</span>
                  <div style={{ marginTop: 8, fontWeight: 800, fontSize: 14.5 }}>Every discount waits for the founder</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#6B5A4D' }}>No written authority limits were reported, so routine pricing decisions queue behind one person.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="why">
          <div className="wrap">
            <h2>AI multiplies whatever it lands on.</h2>
            <p className="sub">Well-run businesses gain from AI because there is something solid for it to build on. Where the foundations are weak, AI scales the weakness. Its effectiveness depends less on the technology than on what sits underneath it: ownership, processes, data, systems, people, controls and visibility of results.</p>
            <div className="cards">
              <div className="card"><div className="num">1</div><h3>Processes live in people’s heads</h3><p>Work that is not written down or done consistently cannot be handed to anyone — or anything — reliably.</p></div>
              <div className="card"><div className="num">2</div><h3>Data is scattered</h3><p>Customer, price and stock information spread across spreadsheets, chat and paper gives AI nothing dependable to read.</p></div>
              <div className="card"><div className="num">3</div><h3>Every decision waits for the founder</h3><p>Where no decision rights are defined, there is no rule for AI to follow and no one accountable for what it produces.</p></div>
            </div>
            <p style={{ marginTop: 24, fontWeight: 800, fontSize: 19 }}>Put AI on top of that and you get faster mess.</p>
          </div>
        </section>

        <section className="section alt" id="dimensions">
          <div className="wrap">
            <div className="eyebrow">What is assessed</div>
            <h2 style={{ marginTop: 8 }}>Five readiness dimensions</h2>
            <p className="sub">Each dimension is scored on its own, then combined into one overall AI Readiness Score.</p>
            <div className="cards">
              {DIMENSIONS.map((d, i) => (
                <div key={d.name} className="card dim-tile">
                  <Moon fraction={[0.2, 0.4, 0.6, 0.8, 1][i]} size={34} />
                  <h3>{d.name}</h3>
                  <p>{d.line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="assessment">
          <div className="wrap">
            <div className="eyebrow">The assessment</div>
            <h2 style={{ marginTop: 8 }}>A structured business assessment, not a quiz</h2>
            <p className="sub">It takes about 8–10 minutes. No card is needed, and nothing is saved by clicking — your progress saves itself.</p>
            <ol className="steps">
              <li><b>Six short phases.</b> Business context, then ownership, processes, data and systems, people and controls, and where you see opportunity.</li>
              <li><b>Scored by fixed rules.</b> The same answers always give the same score. AI never sets the score.</li>
              <li><b>Interpreted for your business.</b> AI then explains the pattern in the context of your industry, size and stated bottlenecks.</li>
              <li><b>Resume any time.</b> Close the browser and continue later with a secure link — no account or password.</li>
            </ol>
          </div>
        </section>

        <section className="section alt">
          <div className="wrap">
            <div className="eyebrow">What you receive</div>
            <h2 style={{ marginTop: 8 }}>A personalised diagnostic</h2>
            <ul className="checklist">
              {['Overall AI Readiness Score', 'Dimension-level assessment across all five dimensions', 'Readiness gaps, with the evidence behind each', 'Potential AI opportunity areas specific to your business', 'Business-specific observations, including founder dependency', 'A diagnostic report you can download (5–7 pages)'].map((t) => (
                <li key={t}><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="11" fill="#C24000" /><g transform="translate(3 3)"><Check size={16} /></g></svg><span>{t}</span></li>
              ))}
            </ul>
            <p className="muted" style={{ marginTop: 20, maxWidth: '64ch' }}>The diagnostic describes where your business stands. It does not prescribe solutions or promise results; what to do about the findings is discussed in a consultation.</p>
          </div>
        </section>

        <section className="section">
          <div className="wrap" style={{ display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
            <div className="card"><h3>Who it is for</h3><p>Founders, CEOs, directors and senior leaders of Indian small and mid-sized businesses — typically ₹1–25 crore turnover and 8–80 people — in manufacturing, trading and services.</p></div>
            <div className="card"><h3>Who it is not for</h3><p>Anyone looking for a tool or vendor recommendation, or a ready-made implementation plan. This is a diagnostic of the business, not a shopping list.</p></div>
            <div className="card" id="privacy-summary"><h3>Your data stays private</h3><p>We collect only what the diagnostic needs. Answers are visible to you and the diagnostic team. The AI interpretation never receives your name, contact details or business name. <Link to="/privacy">Read the privacy notice</Link>.</p></div>
          </div>
        </section>

        <section className="section alt faq" id="faq">
          <div className="wrap narrow" style={{ maxWidth: 820 }}>
            <h2>Questions founders ask</h2>
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>

        <section className="cta-band">
          <div className="wrap">
            <h2>Find out in 10 minutes.</h2>
            <Link className="btn btn-lg" to="/assessment" onClick={cta('final')}>{CTA}</Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap">
          <span>© Amalthea Consultancy · Ahmedabad</span>
          <span><Link to="/privacy">Privacy notice</Link> · <Link to="/resume">Resume an assessment</Link></span>
        </div>
      </footer>

      <div className={`sticky-cta ${on ? 'on' : ''}`} aria-hidden={!on}>
        <Link className="btn btn-primary btn-block" to="/assessment" onClick={cta('sticky')} tabIndex={on ? 0 : -1}>{CTA}</Link>
      </div>
    </div>
  );
}
