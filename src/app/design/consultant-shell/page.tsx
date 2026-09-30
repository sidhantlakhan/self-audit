import type { Metadata } from "next";
import { ConsultantShell, EmptyRegion } from "@/components/shells/ConsultantShell";
import s from "../design.module.css";

export const metadata: Metadata = { title: "S0.4 Consultant Console Shell" };

export default function ConsultantShellPage() {
  return (
    <>
      <div className={s.note}>Desktop only. The console is client-switching first: the top bar carries the client and round, the rail carries the review sequence, and admin items appear only for Admin role.</div>
      <ConsultantShell
        client="Kavya Industrial Supplies · Round 1"
        pending="6 findings awaiting review"
        user={{ initials: "PS", name: "Priya Shah", role: "Consultant" }}
        nav={[
          { heading: "Across clients", items: [{ label: "Audit queue", active: true }, { label: "My reviews", badge: { text: "6", tone: "amber" } }, { label: "Schedule & site visits" }] },
          { heading: "This client", items: ["Client workspace", "Review AI draft", "Site-visit notes", "Score adjustments", "Evidence locker", "Report & approval", "Roadmap builder"].map((label) => ({ label })) },
          { heading: "Admin only", items: ["Question banks", "AI prompts", "Use-case library", "Users & plans"].map((label) => ({ label })) },
        ]}
        footnote="Consultant edits are logged with your name, the old score and your reason."
        visibility={<>Client data is visible to the assigned consultant, the Project Manager and Admin. Access is logged. <a href="/privacy">Privacy notice · DPDP Act, 2023</a></>}
      >
        <EmptyRegion label="Consultant console shell" title="Review content goes here" body="Queue, side-by-side draft review, site-visit notes, score adjustment with reasons, approval and the roadmap builder render inside this region." />
      </ConsultantShell>
    </>
  );
}
