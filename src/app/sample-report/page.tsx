import type { Metadata } from "next";
import { ResultView } from "@/components/result/ResultView";
import { SAMPLE_RESULT } from "@/lib/sample-result";

export const metadata: Metadata = {
  title: "Sample report",
  description: "An illustrative AI-Readiness Scorecard report for a fictional trading business in Rajkot.",
};

export default function SampleReportPage() {
  return <ResultView data={SAMPLE_RESULT} />;
}
