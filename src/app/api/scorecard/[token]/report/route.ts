import { NextResponse } from "next/server";
import { getScorecard } from "@/lib/server/db";
import { generateReport } from "@/lib/server/pipeline";

export const maxDuration = 60;

/** Writes the AI report. On failure the result page shows scores and the WhatsApp fallback. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const sc = await getScorecard((await params).token);
  if (!sc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (sc.status === "draft") return NextResponse.json({ error: "not_submitted" }, { status: 409 });
  return NextResponse.json(await generateReport(sc));
}
