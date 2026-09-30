import type { Metadata } from "next";
import { Suspense } from "react";
import { ScorecardFlow } from "./ScorecardFlow";

export const metadata: Metadata = { title: "AI-Readiness Scorecard" };

export default function ScorecardPage() {
  return (
    <Suspense>
      <ScorecardFlow />
    </Suspense>
  );
}
