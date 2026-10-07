import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, Page } from '../components/ui.tsx';
import { api } from '../lib/api.ts';

export function Privacy() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => { api('/api/public-config').then((c) => setEmail(c.supportEmail)).catch(() => undefined); }, []);
  return (
    <Page header={<div className="topbar"><div className="wrap"><Logo /></div></div>}>
      <div className="wrap section">
        <div className="prose">
          <h1 style={{ fontSize: 'clamp(28px,4vw,40px)', color: 'var(--deep)' }}>Privacy notice</h1>
          <p className="muted">Version privacy-v1. This notice explains what the AI Readiness Diagnostic collects, why, and who can see it.</p>
          <h2>What we collect</h2>
          <ul>
            <li>Your name, business name, mobile number, email address, role and basic business facts (industry, business model, turnover range, team size, years in operation).</li>
            <li>Your answers to the assessment, including any text you type or dictate.</li>
            <li>How you arrived (for example the campaign link you clicked), your device type and the steps you complete. We do not store your answers or contact details in analytics events.</li>
          </ul>
          <h2>Why we collect it</h2>
          <ul>
            <li>To calculate your readiness score and produce your diagnostic and report.</li>
            <li>To let you resume an unfinished assessment, and to send you the links and documents you ask for.</li>
            <li>To follow up about your results and any consultation you choose to book, and to understand which channels bring people to the diagnostic.</li>
          </ul>
          <h2>Who can see it</h2>
          <p>You, through your private link, and the diagnostic team through a protected administration area. Your assessment is not public and cannot be reached by guessing a web address.</p>
          <h2>AI processing</h2>
          <p>After you finish, your answers are sent to an AI service to write the interpretation. We send your answers and business context but not your name, email address, mobile number or business name. The score itself is calculated by fixed rules on our servers; AI does not set or change it.</p>
          <h2>Voice input</h2>
          <p>If you choose to dictate an answer, your browser’s own speech-recognition service converts speech to text, and that service may process your audio under its provider’s terms. Dictation is optional; typing always works.</p>
          <h2>Storage and your rights</h2>
          <p>Data is stored in a protected database and is accessible only to authorised administrators. You may ask to see, correct or delete your data{email ? <> by writing to <a href={`mailto:${email}`}>{email}</a></> : ' by replying to any email you received from us'}.</p>
          <p style={{ marginTop: 28 }}><Link to="/">← Back to the diagnostic</Link></p>
        </div>
      </div>
    </Page>
  );
}
