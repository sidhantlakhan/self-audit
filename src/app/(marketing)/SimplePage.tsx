import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { SiteFooter } from "./Landing";

/** Charcoal top bar + readable column + site footer, for legal and utility pages. */
export function SimplePage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#15120D", borderBottom: "1px solid #3A3027", height: 64, display: "flex", alignItems: "center", gap: 16, padding: "0 clamp(18px, 4vw, 48px)" }}>
        <Link href="/" aria-label="Amalthea home" style={{ display: "flex" }}><Logo dark /></Link>
        <span style={{ flex: "1 1 auto" }} />
        <Link href="/scorecard" className="btn btn-primary btn-sm">Take the Scorecard</Link>
      </header>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: 760, margin: "0 auto", padding: "48px clamp(16px, 4vw, 24px) 64px" }}>
        <div className="eyebrow">{eyebrow}</div>
        <h1 style={{ margin: "8px 0 0", fontSize: "clamp(29px, 5vw, 40px)", lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.02em", color: "#C24000" }}>{title}</h1>
        <div className="prose">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
