import type { Metadata } from "next";
import { FounderMobileShell, FounderShell } from "@/components/shells/FounderShell";
import { EmptyRegion } from "@/components/shells/ConsultantShell";
import { site } from "@/config/site";
import s from "../design.module.css";

export const metadata: Metadata = { title: "S0.3 Founder Workspace Shell" };

export default function FounderShellPage() {
  return (
    <>
      <div className={s.note}>Empty shell only — no stage content yet. Top bar carries the business, audit round and role switcher. Side navigation follows the audit sequence, with the two Amalthea-only items hidden for Tier 2.</div>
      <FounderShell
        business={{ name: "Kavya Industrial Supplies", meta: "Rajkot · ₹4.2 crore · 19 people" }}
        round="Round 1 · Sep 2026"
        user={{ initials: "KM", name: "Kiran Mehta", role: "Founder" }}
        nav={[
          { heading: "Your audit", items: [
            { label: "Dashboard", active: true }, { label: "Business profile", done: true }, { label: "Founder Load", done: true },
            { label: "Health Scan", badge: { text: "7/9", tone: "amber" } }, { label: "Process Walk" },
            { label: "Data Pack", badge: { text: "2", tone: "muted" } }, { label: "AI Opportunities" },
          ] },
          { heading: "Results", items: [{ label: "Report", locked: true }, { label: "90-day roadmap", locked: true }, { label: "Round comparison" }] },
          { heading: "Manage", items: [{ label: "Team & assignments", badge: { text: "1", tone: "red" } }, { label: "Plan & billing" }, { label: "Settings" }] },
        ]}
        upgrade={{ title: "Self-Audit · Tier 2", body: "Add a consultant review for the full Business Process Audit.", cta: site.price.consultantAudit }}
        visibility={<>Your answers are visible to Kiran Mehta, the team members you assign, and the Amalthea audit team. <a href="/privacy">Privacy notice · DPDP Act, 2023</a></>}
      >
        <EmptyRegion label="Founder workspace shell" title="Stage content goes here" body="Dashboard, Founder Load, Health Scan, Process Walk, Data Pack, AI Opportunities, Report and Roadmap each render inside this region. Mobile uses the same navigation as a bottom sheet." />
      </FounderShell>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        <FounderMobileShell business="Kavya Industrial Supplies" sub="Round 1 · Self-Audit" initials="KM">
          <EmptyRegion label="Mobile shell · 390 px" title="Stage content goes here" body="Navigation opens as a bottom sheet from the menu button." />
        </FounderMobileShell>
      </div>
    </>
  );
}
