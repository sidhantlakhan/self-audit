import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Banner, Loading, Logo, Page, Spinner } from '../../components/ui.tsx';
import { api, ApiError, setAdminCsrf } from '../../lib/api.ts';

const label = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDay = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const chip = (s: string | null | undefined) => {
  const v = s ?? '';
  const cls = ['complete', 'booked', 'report_complete', 'analysis_complete', 'consultation_booked', 'ready', 'advanced', 'low'].includes(v) ? 'green' : ['failed', 'foundation', 'very_high', 'high'].includes(v) ? 'red' : ['clicked', 'pending', 'in_progress', 'analysis_pending', 'report_pending', 'processing', 'emerging', 'developing', 'moderate'].includes(v) ? 'amber' : '';
  return <span className={`chip ${cls}`}>{label(v)}</span>;
};

type AdminUser = { email: string; name: string | null };

export function AdminApp() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api('/api/admin/me').then((r) => { setAdminCsrf(r.csrf); setAdmin(r.admin); }).catch(() => undefined).finally(() => setChecked(true));
  }, []);
  // Any 401 from a data call means the session ended.
  useEffect(() => { const h = () => setAdmin(null); window.addEventListener('admin-unauthorised', h); return () => window.removeEventListener('admin-unauthorised', h); }, []);

  if (!checked) return <Loading />;
  if (!admin) return <Login onDone={(a, csrf) => { setAdminCsrf(csrf); setAdmin(a); }} />;
  return <Layout admin={admin} onLogout={() => { setAdmin(null); setAdminCsrf(null); }} />;
}

function useAdminGet<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(() => {
    setLoading(true); setError(null);
    api<T>(path).then(setData).catch((e) => {
      if (e instanceof ApiError && e.status === 401) window.dispatchEvent(new Event('admin-unauthorised'));
      setError(e instanceof ApiError ? e.message : 'Could not load data.');
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(run, [run]);
  return { data, error, loading, reload: run };
}

function Login({ onDone }: { onDone: (a: AdminUser, csrf: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api('/api/admin/login', { method: 'POST', body: { email, password } }); onDone(r.admin, r.csrf); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Sign-in failed.'); setBusy(false); }
  }
  return (
    <Page>
      <meta name="robots" content="noindex" />
      <div className="wrap"><div className="login panel">
        <Logo />
        <h1 style={{ fontSize: 24, marginTop: 18, color: 'var(--deep)' }}>Admin sign-in</h1>
        <form onSubmit={submit} style={{ display: 'grid', gap: 16, marginTop: 18 }}>
          <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="a-pw">Password</label><input id="a-pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {error && <Banner kind="error">{error}</Banner>}
          <button className="btn btn-primary" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div></div>
    </Page>
  );
}

function Layout({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  async function logout() { await api('/api/admin/logout', { method: 'POST' }).catch(() => undefined); onLogout(); }
  return (
    <div className="admin">
      <meta name="robots" content="noindex" />
      <header className="atop"><div className="wrap">
        <Logo to="/admin" dark />
        <nav aria-label="Admin">
          <NavLink to="/admin" end>Dashboard</NavLink><NavLink to="/admin/assessments">Assessments</NavLink><NavLink to="/admin/audit">Audit log</NavLink>
        </nav>
        <div className="who"><span>{admin.email}</span><button className="btn btn-sm btn-dark-ghost" onClick={logout}>Sign out</button></div>
      </div></header>
      <main id="main"><div className="wrap">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="assessments" element={<List />} />
          <Route path="assessments/:id" element={<Detail />} />
          <Route path="audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div></main>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const PRESETS: [string, number | null][] = [['Last 7 days', 7], ['Last 30 days', 30], ['Last 90 days', 90], ['All time', null]];

function RangePicker({ from, to, set }: { from: string; to: string; set: (f: string, t: string) => void }) {
  return (
    <div className="toolbar" role="group" aria-label="Date range">
      {PRESETS.map(([l, days]) => (
        <button key={l} className="btn btn-sm btn-ghost" onClick={() => days === null ? set('', '') : set(isoDay(new Date(Date.now() - days * 864e5)), isoDay(new Date()))}>{l}</button>
      ))}
      <div className="field"><label htmlFor="d-from">From</label><input id="d-from" className="input" type="date" value={from} onChange={(e) => set(e.target.value, to)} /></div>
      <div className="field"><label htmlFor="d-to">To</label><input id="d-to" className="input" type="date" value={to} onChange={(e) => set(from, e.target.value)} /></div>
    </div>
  );
}

function Dashboard() {
  const [range, setRange] = useState({ from: isoDay(new Date(Date.now() - 30 * 864e5)), to: isoDay(new Date()) });
  const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString();
  const { data, error, loading, reload } = useAdminGet<any>(`/api/admin/dashboard${qs ? `?${qs}` : ''}`);
  const m = data?.metrics;
  const max = useMemo(() => Math.max(1, ...(data?.funnel ?? []).map((f: any) => f.value)), [data]);
  return (
    <>
      <h1>Dashboard</h1>
      <RangePicker from={range.from} to={range.to} set={(from, to) => setRange({ from, to })} />
      {error && <Banner kind="error" action={<button className="btn btn-sm btn-ghost" onClick={reload}>Retry</button>}>{error}</Banner>}
      {loading && !data && <div className="kpis">{[...Array(7)].map((_, i) => <div key={i} className="kpi skeleton" style={{ height: 96 }} />)}</div>}
      {data && (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="kpis">
            <div className="kpi primary"><div className="l">Consultation conversion</div><div className="v">{m.consultationConversion}%</div><div className="s">{m.consultationBookings} booked ÷ {m.completed} completed</div></div>
            <div className="kpi"><div className="l">Total assessments</div><div className="v">{m.totalAssessments}</div><div className="s">created in range</div></div>
            <div className="kpi"><div className="l">Started</div><div className="v">{m.started}</div><div className="s">answered at least one question</div></div>
            <div className="kpi"><div className="l">Completed</div><div className="v">{m.completed}</div><div className="s">{m.completionRate}% of started</div></div>
            <div className="kpi"><div className="l">Average readiness</div><div className="v">{m.averageScore}</div><div className="s">out of 100</div></div>
            <div className="kpi"><div className="l">Consultation bookings</div><div className="v">{m.consultationBookings}</div><div className="s">{m.consultationClicks} clicked Book Consultation</div></div>
            {(m.analysisFailed > 0 || m.reportFailed > 0) && <div className="kpi" style={{ borderColor: 'var(--bad)' }}><div className="l" style={{ color: 'var(--bad)' }}>Needs attention</div><div className="v">{m.analysisFailed + m.reportFailed}</div><div className="s">{m.analysisFailed} analysis · {m.reportFailed} report failed</div></div>}
          </div>
          <div className="agrid">
            <section className="apanel"><h2>Funnel</h2>
              {data.funnel.map((f: any) => <div className="hbar" key={f.step}><span>{f.step}</span><div className="tr"><i style={{ width: `${(f.value / max) * 100}%` }} /></div><span className="v tnum">{f.value}</span></div>)}
            </section>
            <section className="apanel"><h2>AI opportunity distribution</h2>
              {data.opportunity.levels.map((l: any) => <div className="hbar" key={l.level}><span>{label(l.level)}</span><div className="tr"><i style={{ width: `${(l.count / Math.max(1, m.completed)) * 100}%` }} /></div><span className="v tnum">{l.count}</span></div>)}
              <h2 style={{ marginTop: 18 }}>Major opportunity areas</h2>
              {data.opportunity.areas.length ? data.opportunity.areas.map((a: any) => <div className="hbar" key={a.area}><span>{a.area}</span><div className="tr"><i style={{ width: `${(a.count / Math.max(1, data.opportunity.areas[0].count)) * 100}%` }} /></div><span className="v tnum">{a.count}</span></div>) : <p className="muted small">No completed assessments in this range.</p>}
            </section>
            <section className="apanel" style={{ gridColumn: '1 / -1' }}><h2>Source performance</h2>
              {data.sources.length ? <div className="tablewrap"><table className="t"><thead><tr><th>Source</th><th>Assessments</th><th>Started</th><th>Completed</th><th>Completion</th><th>Booked</th><th>Consultation conversion</th></tr></thead><tbody>
                {data.sources.map((s: any) => <tr key={s.source}><td><b>{label(s.source)}</b></td><td className="tnum">{s.assessments}</td><td className="tnum">{s.started}</td><td className="tnum">{s.completed}</td><td className="tnum">{s.completionRate}%</td><td className="tnum">{s.booked}</td><td className="tnum"><b>{s.conversion}%</b></td></tr>)}
              </tbody></table></div> : <p className="muted">No data in this range.</p>}
            </section>
            <section className="apanel" style={{ gridColumn: '1 / -1' }}><h2>Campaign performance</h2>
              {data.campaigns.length ? <div className="tablewrap"><table className="t"><thead><tr><th>Campaign</th><th>Source</th><th>Assessments</th><th>Completed</th><th>Booked</th><th>Consultation conversion</th></tr></thead><tbody>
                {data.campaigns.map((c: any) => <tr key={c.campaign + c.source}><td><b>{c.campaign}</b></td><td>{c.source}</td><td className="tnum">{c.assessments}</td><td className="tnum">{c.completed}</td><td className="tnum">{c.booked}</td><td className="tnum"><b>{c.conversion}%</b></td></tr>)}
              </tbody></table></div> : <p className="muted">No tagged campaigns in this range.</p>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

// ── List ─────────────────────────────────────────────────────────────

const STATUSES = ['started', 'in_progress', 'completed', 'analysis_pending', 'analysis_complete', 'report_pending', 'report_complete', 'consultation_booked'];

function List() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const params = Object.fromEntries(sp.entries());
  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); } if (!('page' in patch)) n.delete('page'); setSp(n, { replace: true }); };
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') ?? '') !== q) set({ q }); }, 350); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, error, loading, reload } = useAdminGet<any>(`/api/admin/assessments?${sp.toString()}`);
  const sort = params.sort ?? 'created';
  const dir = params.dir ?? 'desc';
  const th = (key: string, text: string) => <th aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button onClick={() => set({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc' })}>{text}{sort === key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>;
  const sel = (name: string, text: string, opts: [string, string][]) => (
    <div className="field"><label htmlFor={`f-${name}`}>{text}</label>
      <select id={`f-${name}`} className="select" value={params[name] ?? ''} onChange={(e) => set({ [name]: e.target.value })}><option value="">All</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  );
  const page = Number(params.page ?? 1);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <h1>Assessments</h1>
      <div className="toolbar" role="search">
        <div className="field"><label htmlFor="f-q">Search</label><input id="f-q" className="input" type="search" placeholder="Name, business, email, mobile" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} /></div>
        {sel('status', 'Status', STATUSES.map((s) => [s, label(s)]))}
        {sel('industry', 'Industry', (data?.facets.industries ?? []).map((s: string) => [s, s]))}
        {sel('source', 'Source', (data?.facets.sources ?? []).map((s: string) => [s, label(s)]))}
        {sel('band', 'Readiness', ['foundation', 'emerging', 'developing', 'ready', 'advanced'].map((s) => [s, label(s)]))}
        {sel('opportunity', 'Opportunity', ['high', 'moderate', 'limited'].map((s) => [s, label(s)]))}
        {sel('consultation', 'Consultation', [['none', 'None'], ['clicked', 'Clicked'], ['booked', 'Booked']])}
        <div className="field"><label htmlFor="f-from">From</label><input id="f-from" className="input" type="date" value={params.from ?? ''} onChange={(e) => set({ from: e.target.value })} /></div>
        <div className="field"><label htmlFor="f-to">To</label><input id="f-to" className="input" type="date" value={params.to ?? ''} onChange={(e) => set({ to: e.target.value })} /></div>
        {sp.toString() && <button className="btn btn-sm btn-ghost" onClick={() => { setQ(''); setSp({}); }}>Clear filters</button>}
      </div>
      {error && <Banner kind="error" action={<button className="btn btn-sm btn-ghost" onClick={reload}>Retry</button>}>{error}</Banner>}
      <div className="tablewrap" aria-busy={loading}>
        {loading && !data ? <div style={{ padding: 20 }}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 38, marginBottom: 10 }} />)}</div> : data && data.rows.length === 0 ? (
          <div className="empty"><b>No assessments found</b>{sp.toString() ? 'Try changing or clearing the filters.' : 'Assessments will appear here as people start the diagnostic.'}</div>
        ) : data && (
          <table className="t"><thead><tr>{th('name', 'Name')}{th('business', 'Business')}<th>Industry</th><th>Turnover</th><th>Team</th><th>Mobile</th><th>Email</th><th>Source</th>{th('status', 'Status')}{th('score', 'Readiness')}<th>Opportunity</th>{th('completed', 'Completed')}<th>Consultation</th></tr></thead>
            <tbody>{data.rows.map((r: any) => (
              <tr key={r.id}>
                <td><Link className="row" to={`/admin/assessments/${r.id}`}>{r.name ?? '(not provided yet)'}</Link></td><td>{r.business ?? '—'}</td><td>{r.industry ?? '—'}</td><td>{r.turnover ?? '—'}</td><td>{r.teamSize ?? '—'}</td>
                <td>{r.mobile ?? '—'}</td><td>{r.email ?? '—'}</td><td>{label(r.source)}{r.campaign ? <div className="small muted">{r.campaign}</div> : null}</td>
                <td>{chip(r.status)}{r.status === 'in_progress' || r.status === 'started' ? <div className="small muted">{r.progress}%</div> : null}{r.analysisStatus === 'failed' && <div><span className="chip red">AI failed</span></div>}</td>
                <td className="tnum">{r.score !== null ? <><b>{r.score}</b> {chip(r.band)}</> : '—'}</td><td>{r.opportunity ? chip(r.opportunity) : '—'}</td><td>{fmtDay(r.completedAt)}</td><td>{chip(r.consultation)}</td>
              </tr>))}</tbody></table>
        )}
      </div>
      {data && data.total > 0 && (
        <div className="pager"><span className="muted small">{data.total} assessment{data.total === 1 ? '' : 's'} · page {page} of {pages}</span>
          <span style={{ display: 'flex', gap: 8 }}><button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>← Previous</button><button className="btn btn-sm btn-ghost" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next →</button></span></div>
      )}
    </>
  );
}

// ── Detail ───────────────────────────────────────────────────────────

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v));
const TABS = ['Overview', 'Answers', 'Scores', 'AI analysis', 'Report', 'Consultation'] as const;

function Detail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const { data: d, error, loading, reload } = useAdminGet<any>(`/api/admin/assessments/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(path: string, text: string, body?: unknown) {
    setBusy(path); setNote(null);
    try { await api(`/api/admin/assessments/${id}/${path}`, { method: 'POST', body: body ?? {} }); setNote(text); setTimeout(reload, 1500); }
    catch (e) { setNote(e instanceof ApiError ? e.message : 'Action failed.'); }
    finally { setBusy(null); }
  }

  if (loading && !d) return <Loading />;
  if (error || !d) return <div className="empty"><b>{error ?? 'Not found'}</b><button className="btn btn-ghost" onClick={() => nav('/admin/assessments')}>Back to assessments</button></div>;
  const o = d.overview, s = d.score, an = d.analysis;
  return (
    <>
      <p><Link to="/admin/assessments">← Assessments</Link></p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <h1>{o.respondent ?? 'Unnamed respondent'} <span className="muted" style={{ fontWeight: 600 }}>· {o.business ?? 'business not provided'}</span></h1>
        {chip(o.status)}
      </div>
      {note && <div style={{ marginTop: 12 }}><Banner kind="info">{note}</Banner></div>}
      <div className="tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === 'Overview' && (
        <div className="agrid">
          <section className="apanel"><h2>Respondent &amp; business</h2><dl className="kv">
            <dt>Name</dt><dd>{show(o.respondent)}</dd><dt>Role</dt><dd>{show(o.role)}</dd><dt>Business</dt><dd>{show(o.business)}</dd><dt>Email</dt><dd>{show(o.email)}</dd><dt>Mobile</dt><dd>{show(o.mobile)}</dd>
            <dt>Industry</dt><dd>{show(o.industry)}</dd><dt>Business model</dt><dd>{show(o.businessModel)}</dd><dt>Turnover</dt><dd>{show(o.turnover)}</dd><dt>Team size</dt><dd>{show(o.teamSize)}</dd><dt>Years in operation</dt><dd>{show(o.yearsInOperation)}</dd></dl></section>
          <section className="apanel"><h2>Status &amp; dates</h2><dl className="kv">
            <dt>Status</dt><dd>{chip(o.status)}</dd><dt>Progress</dt><dd>{o.completion}% · phase {o.currentPhase > 6 ? 'review' : o.currentPhase}</dd>
            <dt>Created</dt><dd>{fmt(o.dates.created)}</dd><dt>Started</dt><dd>{fmt(o.dates.started)}</dd><dt>Last activity</dt><dd>{fmt(o.dates.lastActivity)}</dd><dt>Completed</dt><dd>{fmt(o.dates.completed)}</dd>
            <dt>Analysis</dt><dd>{chip(o.analysisStatus)} {fmt(o.dates.analysisCompleted)}</dd><dt>Report</dt><dd>{chip(o.reportStatus)} {fmt(o.dates.reportGenerated)}</dd><dt>Consultation</dt><dd>{chip(o.consultationStatus)} {fmt(o.dates.consultationBooked)}</dd>
            <dt>Versions</dt><dd>assessment {o.versions.assessment} · scoring {show(o.versions.scoring)} · prompt {show(o.versions.prompt)} · report {show(o.versions.report)}</dd></dl></section>
          <section className="apanel"><h2>Source attribution</h2>{d.attribution ? <dl className="kv">
            <dt>First touch</dt><dd>{label(d.attribution.first_category)} — {[d.attribution.first_source, d.attribution.first_medium, d.attribution.first_campaign].filter(Boolean).join(' / ') || 'no campaign parameters'}</dd>
            <dt>Latest touch</dt><dd>{label(d.attribution.latest_category)} — {[d.attribution.latest_source, d.attribution.latest_medium, d.attribution.latest_campaign].filter(Boolean).join(' / ') || 'no campaign parameters'}</dd>
            <dt>Landing URL</dt><dd>{show(d.attribution.landing_url)}</dd><dt>Referrer</dt><dd>{show(d.attribution.referrer)}</dd><dt>Device</dt><dd>{show(d.attribution.device)}</dd><dt>First seen</dt><dd>{fmt(d.attribution.first_touch_at)}</dd></dl> : <p className="muted">No attribution recorded.</p>}</section>
          <section className="apanel"><h2>Activity</h2>{d.events.length ? <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6, fontSize: 14, maxHeight: 300, overflow: 'auto' }}>{d.events.map((e: any, i: number) => <li key={i}><span className="muted">{fmt(e.at)}</span> · <b>{label(e.event)}</b>{e.props?.phase ? ` (phase ${e.props.phase})` : ''}</li>)}</ul> : <p className="muted">No events.</p>}
            {d.messages.length > 0 && <><h2 style={{ marginTop: 16 }}>Messages</h2><ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 14 }}>{d.messages.map((m: any, i: number) => <li key={i}>{fmt(m.at)} · {m.channel} · {label(m.template)} · {chip(m.status)}</li>)}</ul></>}</section>
        </div>
      )}

      {tab === 'Answers' && d.phases.map((p: any) => (
        <section key={p.number} className="apanel" style={{ marginBottom: 14 }}><h2>Phase {p.number} · {p.title}</h2>
          <dl className="kv">{p.answers.map((a: any) => <><dt key={a.id + 'd'}>{a.id}{a.scored ? '' : ' · context'}</dt><dd key={a.id}><span className="muted">{a.question}</span><br />{a.type === 'ranking' && Array.isArray(a.answer) ? a.answer.map((x: string, i: number) => `${i + 1}. ${x}`).join('  ') : a.type === 'rating' && a.answer ? `${a.answer} of 5` : show(a.answer)}</dd></>)}</dl></section>
      ))}

      {tab === 'Scores' && (s ? (
        <div className="agrid">
          <section className="apanel"><h2>Overall</h2><div style={{ fontSize: 44, fontWeight: 800, color: 'var(--deep)' }}>{s.overallRounded}<small className="muted" style={{ fontSize: 16 }}> / 100 · {s.band.label}</small></div>
            <p className="muted small">Full precision {s.overall.toFixed(3)} · scoring {s.scoringVersion} · assessment {s.assessmentVersion}</p>
            {s.dimensions.map((x: any) => <div className="hbar" key={x.dimension}><span>{x.label}</span><div className="tr"><i style={{ width: `${x.score}%` }} /></div><span className="v tnum">{Math.round(x.score)}</span></div>)}</section>
          <section className="apanel"><h2>Derived indicators</h2><dl className="kv">
            <dt>Founder dependency</dt><dd>{s.founderDependency.label} (index {Math.round(s.founderDependency.index)})<ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.founderDependency.signals.map((x: string) => <li key={x}>{x}</li>)}</ul></dd>
            <dt>Opportunity profile</dt><dd>{s.opportunity.label}<ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.opportunity.areas.map((x: any) => <li key={x.id}>{x.label} — {x.strength} ({x.sources.join('; ')})</li>)}</ul></dd>
            <dt>Priority outcomes</dt><dd>{show(s.opportunity.priorityOutcomes)}</dd><dt>AI adoption intent</dt><dd>{s.adoptionIntent.label} {s.adoptionIntent.rating ? `(${s.adoptionIntent.rating}/5)` : ''}</dd><dt>Profile</dt><dd>{s.profile.label}</dd></dl></section>
          <section className="apanel" style={{ gridColumn: '1 / -1' }}><h2>Question-level scores</h2><div className="tablewrap"><table className="t"><thead><tr><th>Dimension</th><th>Question</th><th>Score</th><th>Weight</th></tr></thead><tbody>
            {s.dimensions.flatMap((x: any) => x.questions.map((qq: any) => <tr key={qq.questionId}><td>{x.label}</td><td>{qq.questionId}</td><td className="tnum">{Math.round(qq.score)}</td><td className="tnum">{qq.weight}</td></tr>))}</tbody></table></div></section>
        </div>
      ) : <p className="muted">Not scored yet — the assessment is incomplete.</p>)}

      {tab === 'AI analysis' && (
        <section className="apanel">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>Interpretation</h2>{chip(an?.status ?? 'not_started')}
            {an && <span className="muted small">{an.provider} · {an.model} · prompt {an.promptVersion} · attempts {an.attempts}</span>}
            {o.completion === 100 && an?.status !== 'complete' && <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act('retry-analysis', 'Analysis queued. Refreshing shortly…')}>{busy === 'retry-analysis' ? 'Queuing…' : 'Retry analysis'}</button>}</div>
          {an?.error && <p className="err" style={{ marginTop: 10 }}>Last error: {an.error}</p>}
          {an?.output ? <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
            <div><h3>Executive assessment</h3><p>{an.output.executive_assessment}</p></div><div><h3>Readiness interpretation</h3><p>{an.output.readiness_interpretation}</p></div>
            <div><h3>Dimension insights</h3><ul>{an.output.dimension_insights.map((x: any) => <li key={x.dimension}><b>{label(x.dimension)}:</b> {x.insight}</li>)}</ul></div>
            <div><h3>Key readiness gaps</h3><ul>{an.output.key_readiness_gaps.map((g: any) => <li key={g.title}><b>{g.title}.</b> {g.evidence} <i>{g.why_it_matters}</i></li>)}</ul></div>
            <div><h3>Founder dependency</h3><p>{an.output.founder_dependency_insight}</p></div>
            <div><h3>AI opportunity areas</h3><ul>{an.output.ai_opportunity_areas.map((g: any) => <li key={g.area}><b>{g.area}.</b> {g.rationale} <i>{g.readiness_note}</i></li>)}</ul></div>
            <div><h3>Business observations</h3><ul>{an.output.business_context_observations.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
            <div><h3>Consultation focus areas</h3><ul>{an.output.consultation_focus_areas.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
          </div> : <p className="muted" style={{ marginTop: 12 }}>No interpretation available yet.</p>}
        </section>
      )}

      {tab === 'Report' && (
        <section className="apanel"><h2>Report</h2>
          {d.report ? <dl className="kv"><dt>Status</dt><dd>{chip(d.report.status)}</dd><dt>Version</dt><dd>{d.report.version}</dd><dt>Generated</dt><dd>{fmt(d.report.generatedAt)}</dd><dt>Size</dt><dd>{d.report.bytes ? `${Math.round(d.report.bytes / 1024)} KB` : '—'}</dd>{d.report.error && <><dt>Error</dt><dd className="err">{d.report.error}</dd></>}</dl> : <p className="muted">No report yet.</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {d.report?.status === 'complete' && <a className="btn btn-primary" href={`/api/admin/assessments/${id}/report`} target="_blank" rel="noopener noreferrer">Open PDF</a>}
            {an?.status === 'complete' && <button className="btn btn-ghost" disabled={!!busy} onClick={() => act('regenerate-report', 'Report regeneration queued. Refreshing shortly…')}>Regenerate report</button>}
          </div>
          {d.jobs.length > 0 && <><h2 style={{ marginTop: 20 }}>Background jobs</h2><div className="tablewrap"><table className="t"><thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th><th>Error</th></tr></thead><tbody>{d.jobs.map((j: any, i: number) => <tr key={i}><td>{j.type}</td><td>{chip(j.status)}</td><td>{j.attempts}</td><td>{fmt(j.createdAt)}</td><td>{j.error ?? '—'}</td></tr>)}</tbody></table></div></>}
        </section>
      )}

      {tab === 'Consultation' && (
        <section className="apanel"><h2>Consultation</h2>
          <dl className="kv"><dt>Status</dt><dd>{chip(d.consultation?.status ?? 'none')}</dd><dt>Clicked Book Consultation</dt><dd>{fmt(d.consultation?.clickedAt)}</dd><dt>Booked</dt><dd>{fmt(d.consultation?.bookedAt)}</dd><dt>Booking reference</dt><dd>{show(d.consultation?.reference)}</dd><dt>Confirmed via</dt><dd>{show(d.consultation?.source)}</dd></dl>
          {d.consultation?.status !== 'booked' && o.completion === 100 && <div style={{ marginTop: 16 }}><button className="btn btn-ghost" disabled={!!busy} onClick={() => { if (window.confirm('Mark this consultation as booked? This counts toward consultation conversion.')) void act('mark-booked', 'Marked as booked.'); }}>Mark as booked…</button><p className="hint" style={{ marginTop: 6 }}>Use when a booking was made outside the booking system. Recorded in the audit log.</p></div>}
        </section>
      )}
    </>
  );
}

function Audit() {
  const { data, error, loading } = useAdminGet<{ rows: any[] }>('/api/admin/audit-log');
  return (
    <>
      <h1>Audit log</h1>
      {error && <Banner kind="error">{error}</Banner>}
      {loading && !data && <div style={{ marginTop: 18 }}><Spinner /></div>}
      {data && (data.rows.length ? <div className="tablewrap" style={{ marginTop: 18 }}><table className="t"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th></tr></thead><tbody>{data.rows.map((r, i) => <tr key={i}><td>{fmt(r.at)}</td><td>{r.admin ?? '—'}</td><td><b>{r.action}</b></td><td>{r.entity ? `${r.entity} ${String(r.entityId ?? '').slice(0, 10)}` : '—'}</td></tr>)}</tbody></table></div> : <div className="empty"><b>No activity recorded</b></div>)}
    </>
  );
}
