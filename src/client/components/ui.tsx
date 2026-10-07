import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BAND_MOON, moonPath } from '../../shared/moon.ts';

export const BAND_COLOR: Record<string, string> = {
  foundation: 'var(--band-foundation)', emerging: 'var(--band-emerging)', developing: 'var(--band-developing)', ready: 'var(--band-ready)', advanced: 'var(--band-advanced)',
};

export function Moon({ fraction = 0.55, size = 24, stroke = '#C24000', fill = '#F5A020', label }: { fraction?: number; size?: number; stroke?: string; fill?: string; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: 'none' }}>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke={stroke} strokeWidth="1.4" />
      <path d={moonPath(fraction)} fill={fill} />
    </svg>
  );
}

export const BandMoon = ({ band, size = 28 }: { band: string; size?: number }) => <Moon fraction={BAND_MOON[band] ?? 0.5} size={size} stroke={BAND_COLOR[band]} fill={BAND_COLOR[band]} />;

export function Logo({ to = '/', dark = false }: { to?: string; dark?: boolean }) {
  return (
    <Link to={to} className="brand" style={dark ? { color: '#fff' } : undefined} aria-label="Amalthea — AI Readiness Diagnostic">
      <Moon size={30} fraction={0.55} stroke={dark ? '#F5A020' : '#C24000'} />
      <span><b>Amalthea</b><small style={dark ? { color: '#EADBC8' } : undefined}>AI Readiness Diagnostic</small></span>
    </Link>
  );
}

export function Gauge({ score, band, size = 168 }: { score: number; band?: string; size?: number }) {
  const r = 52, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, score)) / 100;
  const color = band ? BAND_COLOR[band] : 'var(--orange)';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`AI readiness score ${score} out of 100`} style={{ flex: 'none' }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#EADBC8" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" fontFamily="Mulish" fontSize="36" fontWeight="800" fill="#241B14">{score}</text>
      <text x="60" y="83" textAnchor="middle" fontFamily="Mulish" fontSize="10" fontWeight="700" fill="#6B5A4D">out of 100</text>
    </svg>
  );
}

export const Spinner = ({ label }: { label?: string }) => <span className="spinner" role="status" aria-label={label ?? 'Loading'} />;

export function Loading({ message = 'Loading…' }: { message?: string }) {
  return <div className="center"><div className="inner"><Spinner label={message} /><p className="muted">{message}</p></div></div>;
}

export function Banner({ kind = 'info', children, action }: { kind?: 'info' | 'error' | 'ok'; children: ReactNode; action?: ReactNode }) {
  return <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : 'status'}><div className="grow">{children}</div>{action}</div>;
}

export const Check = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function Bar({ value, color }: { value: number; color?: string }) {
  return <div className="bar sm" role="presentation"><i style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} /></div>;
}

export function Page({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="page">
      <a href="#main" className="skip">Skip to content</a>
      {header}
      <main id="main" tabIndex={-1}>{children}</main>
    </div>
  );
}

export function NotFound() {
  return (
    <Page header={<div className="topbar"><div className="wrap"><Logo /></div></div>}>
      <div className="center"><div className="inner"><h1>Page not found</h1><p className="muted">The page you are looking for does not exist.</p><Link className="btn btn-primary" to="/">Back to the start</Link></div></div>
    </Page>
  );
}
