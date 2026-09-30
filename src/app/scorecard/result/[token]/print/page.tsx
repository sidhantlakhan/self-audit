import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintReport } from "@/components/result/PrintReport";
import { getScorecard } from "@/lib/server/db";
import { resultDataFor } from "@/lib/server/result-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI-Readiness Scorecard · PDF", robots: { index: false, follow: false } };

export default async function PrintPage({ params }: { params: Promise<{ token: string }> }) {
  const sc = await getScorecard((await params).token);
  if (!sc || sc.status !== "report_ready") notFound();
  return <PrintReport data={resultDataFor(sc)} />;
}
