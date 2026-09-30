import { NextResponse } from "next/server";
import { computeScores, firstIncompletePillar, validateDetails } from "@/lib/scorecard";
import { getScorecard, markScored } from "@/lib/server/db";

/** Locks the answers and applies the fixed scoring rules. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const sc = await getScorecard((await params).token);
  if (!sc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (sc.status !== "draft") {
    return NextResponse.json({ total: sc.total, pillars: sc.pillarScores, band: sc.band });
  }
  if (Object.keys(validateDetails(sc.details)).length) {
    return NextResponse.json({ error: "details_incomplete" }, { status: 422 });
  }
  const missing = firstIncompletePillar(sc.answers);
  if (missing >= 0) return NextResponse.json({ error: "answers_incomplete", pillar: missing }, { status: 422 });
  const s = computeScores(sc.answers);
  await markScored(sc.token, s.total, s.pillars, s.band);
  return NextResponse.json({ total: s.total, pillars: s.pillars, band: s.band });
}
