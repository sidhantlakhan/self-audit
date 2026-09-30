import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResultView } from "@/components/result/ResultView";
import { getScorecard } from "@/lib/server/db";
import { resultDataFor } from "@/lib/server/result-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your AI-Readiness result", robots: { index: false, follow: false } };

export default async function ResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sc = await getScorecard(token);
  if (!sc) notFound();
  if (sc.status === "draft") redirect(`/scorecard?resume=${token}`);
  return <ResultView data={resultDataFor(sc)} />;
}
