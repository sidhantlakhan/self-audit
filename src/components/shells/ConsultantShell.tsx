import type { ReactNode } from "react";
import { Moon } from "@/components/brand";
import { NavList, type NavItem } from "./FounderShell";
import s from "./shells.module.css";

export interface ConsultantShellProps {
  client: string;
  pending?: string;
  user: { initials: string; name: string; role: string };
  nav: { heading: string; items: NavItem[] }[];
  footnote: string;
  visibility: ReactNode;
  children: ReactNode;
}

/** S0.4 — Amalthea console frame. Desktop only; client-switching first. */
export function ConsultantShell(p: ConsultantShellProps) {
  return (
    <div className={s.frame}>
      <div className={s.topbar} style={{ background: "#15120D", borderBottom: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Moon phase={3} size={24} stroke="#F5A020" strokeWidth={1.4} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFAF3" }}>Amalthea Console</span>
        </div>
        <button type="button" className={s.roundBtn} style={{ background: "rgba(255,250,243,0.08)", border: "1px solid #6B5A4D", color: "#FFFAF3", fontSize: 12.5 }}>
          {p.client}
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3 3 3-3" stroke="#F5A020" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: "1 1 20px" }} />
        {p.pending && <span style={{ padding: "6px 11px", background: "#FDF4E3", borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: "#B7791F" }}>{p.pending}</span>}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div className={s.avatar} style={{ background: "#E8650A", color: "#FFFFFF" }}>{p.user.initials}</div>
          <div><div style={{ fontSize: 12.5, fontWeight: 700, color: "#FFFAF3" }}>{p.user.name}</div><div style={{ fontSize: 10.5, fontWeight: 700, color: "#F5A020" }}>{p.user.role}</div></div>
        </div>
      </div>
      <div className={s.body}>
        <nav className={s.rail} aria-label="Console">
          {p.nav.map((g, i) => (
            <div key={g.heading}>
              <div className={s.railHeading} style={i === 0 ? { marginTop: 0 } : undefined}>{g.heading}</div>
              <NavList items={g.items} />
            </div>
          ))}
          <div style={{ flex: "1 1 auto" }} />
          <div style={{ marginTop: 16, padding: 12, background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 10, fontSize: 11, lineHeight: 1.5, color: "#6B5A4D" }}>{p.footnote}</div>
        </nav>
        <div className={s.content}>{p.children}</div>
      </div>
      <div className={s.visibility}>{p.visibility}</div>
    </div>
  );
}

/** Centred placeholder used inside a shell before a stage's content exists. */
export function EmptyRegion({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div style={{ padding: "44px 32px", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <Moon phase={0} size={44} stroke="#EADBC8" style={{ marginBottom: 14 }} />
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B5A4D" }}>{label}</div>
        <h3 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.015em" }}>{title}</h3>
        <p style={{ margin: "9px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "#6B5A4D" }}>{body}</p>
      </div>
    </div>
  );
}
