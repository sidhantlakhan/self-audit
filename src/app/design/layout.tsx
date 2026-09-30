import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { DesignNav } from "./DesignNav";
import s from "./design.module.css";

export const metadata: Metadata = { title: { default: "Design system", template: "%s · Design system" }, robots: { index: false, follow: false } };

/** Internal reference: the Stage 0 style guide, sitemap and empty shells. */
export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.layout}>
      <aside className={s.aside}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #EADBC8" }}>
          <Logo size={26} fontSize={14} />
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#6B5A4D", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4, paddingLeft: 35 }}>AI-Ready Audit</div>
        </div>
        <DesignNav />
      </aside>
      <main className={s.main}>{children}</main>
    </div>
  );
}
