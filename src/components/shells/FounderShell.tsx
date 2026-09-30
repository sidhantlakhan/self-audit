import type { ReactNode } from "react";
import { Moon } from "@/components/brand";
import { Check } from "@/components/icons";
import s from "./shells.module.css";

export interface NavItem {
  label: string;
  active?: boolean;
  done?: boolean;
  badge?: { text: string; tone: "amber" | "muted" | "red" };
  locked?: boolean;
}

export interface FounderShellProps {
  business: { name: string; meta: string };
  round: string;
  user: { initials: string; name: string; role: string };
  nav: { heading: string; items: NavItem[] }[];
  /** Tier 2 only: upsell card for the consultant-led audit. */
  upgrade?: { title: string; body: string; cta: string };
  visibility: ReactNode;
  children: ReactNode;
}

const BADGE = {
  amber: { background: "#FDF4E3", color: "#B7791F", border: "none" },
  muted: { background: "#FFFAF3", color: "#6B5A4D", border: "1px solid #EADBC8" },
  red: { background: "#FADBD8", color: "#C62828", border: "none" },
};

export function NavList({ items }: { items: NavItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((it) => (
        <div key={it.label} className={`${s.navItem} ${it.active ? s.navActive : ""}`} aria-current={it.active ? "page" : undefined} style={it.locked ? { color: "#6B5A4D" } : undefined}>
          <span>{it.label}</span>
          {it.done && <Check size={15} color="#2E7D32" />}
          {it.badge && <span className={s.navBadge} style={BADGE[it.badge.tone]}>{it.badge.text}</span>}
          {it.locked && <span className={s.navBadge} style={BADGE.muted}>Locked</span>}
        </div>
      ))}
    </div>
  );
}

/** S0.3 — frame every founder-facing stage (Stages 3–9) renders inside. */
export function FounderShell(p: FounderShellProps) {
  return (
    <div className={s.frame}>
      <div className={s.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Moon phase={2} size={24} strokeWidth={1.4} />
          <span style={{ fontSize: 14, fontWeight: 800 }}>Amalthea</span>
        </div>
        <div style={{ height: 24, width: 1, background: "#EADBC8" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.business.name}</div>
          <div style={{ fontSize: 11, color: "#6B5A4D" }}>{p.business.meta}</div>
        </div>
        <button type="button" className={s.roundBtn}>
          {p.round}
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3 3 3-3" stroke="#6B5A4D" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: "1 1 20px" }} />
        <span style={{ padding: "6px 11px", background: "#EAF4EB", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#2E7D32" }}>Saved</span>
        <button type="button" className={s.iconBtn} aria-label="Notifications">
          <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a4.5 4.5 0 00-4.5 4.5c0 4-1.8 5.2-1.8 5.2h12.6s-1.8-1.2-1.8-5.2A4.5 4.5 0 0010 3zM8.4 15.6a1.8 1.8 0 003.2 0" stroke="#241B14" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 6 }}>
          <div className={s.avatar} style={{ background: "#F5A020", color: "#241B14" }}>{p.user.initials}</div>
          <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.user.name}</div><div style={{ fontSize: 10.5, fontWeight: 700, color: "#6B5A4D" }}>{p.user.role}</div></div>
        </div>
      </div>
      <div className={s.body}>
        <nav className={s.rail} aria-label="Audit">
          {p.nav.map((g, i) => (
            <div key={g.heading}>
              <div className={s.railHeading} style={i === 0 ? { marginTop: 0 } : undefined}>{g.heading}</div>
              <NavList items={g.items} />
            </div>
          ))}
          <div style={{ flex: "1 1 auto" }} />
          {p.upgrade && (
            <div style={{ marginTop: 16, padding: 12, background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Moon phase={2} size={16} strokeWidth={1.5} /><span style={{ fontSize: 11.5, fontWeight: 800 }}>{p.upgrade.title}</span></div>
              <div style={{ fontSize: 11, color: "#6B5A4D", marginTop: 6, lineHeight: 1.5 }}>{p.upgrade.body}</div>
              <button type="button" className="btn btn-outline" style={{ marginTop: 9, width: "100%", minHeight: 36, fontSize: 12, padding: 0, borderWidth: 1.5 }}>{p.upgrade.cta}</button>
            </div>
          )}
        </nav>
        <div className={s.content}>{p.children}</div>
      </div>
      <div className={s.visibility}>{p.visibility}</div>
    </div>
  );
}

/** Mobile founder frame: top bar, content, bottom tab bar. Navigation opens as a bottom sheet from the menu button. */
export function FounderMobileShell({ business, sub, initials, children }: { business: string; sub: string; initials: string; children: ReactNode }) {
  const tabs = [
    ["Audit", "M3 9l7-6 7 6v8a1 1 0 01-1 1h-4v-6H8v6H4a1 1 0 01-1-1V9z"],
    ["Scores", "M4 16V8m4 8V4m4 12v-6m4 6V6"],
    ["Report", "M5 3h7l3 3v11H5z"],
    ["Team", "M8 9.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2zM3.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"],
  ];
  return (
    <div className={s.phone}>
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #EADBC8", padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className={s.iconBtn} style={{ border: "none", width: 44, height: 44 }} aria-label="Open navigation">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="#241B14" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{business}</div>
          <div style={{ fontSize: 10.5, color: "#6B5A4D" }}>{sub}</div>
        </div>
        <div className={s.avatar} style={{ background: "#F5A020", color: "#241B14", fontSize: 12.5 }}>{initials}</div>
      </div>
      <div style={{ flex: "1 1 auto" }}>{children}</div>
      <nav style={{ background: "#FFFFFF", borderTop: "1px solid #EADBC8", padding: "8px 6px", display: "flex" }} aria-label="Sections">
        {tabs.map(([label, d], i) => (
          <div key={label} style={{ flex: "1 1 0", minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d={d} stroke={i === 0 ? "#C24000" : "#6B5A4D"} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontSize: 10.5, fontWeight: i === 0 ? 800 : 700, color: i === 0 ? "#C24000" : "#6B5A4D" }}>{label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}
