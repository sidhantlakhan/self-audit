"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/design", "S0.1", "Style Guide"],
  ["/design/sitemap", "S0.2", "Sitemap & Roles"],
  ["/design/founder-shell", "S0.3", "Founder Workspace Shell"],
  ["/design/consultant-shell", "S0.4", "Consultant Console Shell"],
] as const;

const LIVE = [
  ["/", "S1.1", "Landing page"],
  ["/scorecard", "S2.x", "Scorecard"],
  ["/sample-report", "S10.5", "Sample report"],
] as const;

function Item({ href, id, label, active }: { href: string; id: string; label: string; active: boolean }) {
  return (
    <Link
      href={href} aria-current={active ? "page" : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, fontSize: 13, color: "#241B14", textDecoration: "none",
        background: active ? "#FDF4E3" : "transparent", border: `1px solid ${active ? "#F5A020" : "transparent"}`, fontWeight: active ? 800 : 600,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 800, color: "#C24000", minWidth: 34 }}>{id}</span>
      <span>{label}</span>
    </Link>
  );
}

export function DesignNav() {
  const path = usePathname();
  const heading = { fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#6B5A4D", padding: "0 8px 8px" };
  return (
    <>
      <div style={{ padding: "18px 14px 6px" }}>
        <div style={heading}>Stage 0 · Foundations</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {ITEMS.map(([href, id, label]) => <Item key={href} href={href} id={id} label={label} active={path === href} />)}
        </nav>
      </div>
      <div style={{ padding: "10px 14px 6px" }}>
        <div style={heading}>Live screens</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {LIVE.map(([href, id, label]) => <Item key={href} href={href} id={id} label={label} active={false} />)}
        </nav>
      </div>
    </>
  );
}
