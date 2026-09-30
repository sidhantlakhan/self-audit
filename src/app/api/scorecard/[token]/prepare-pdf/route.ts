import { NextResponse, type NextRequest } from "next/server";
import { getScorecard } from "@/lib/server/db";
import { ensurePdf } from "@/lib/server/pipeline";

export const maxDuration = 60;

/** Renders and caches the PDF so Download and Send are instant. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const sc = await getScorecard((await params).token);
  if (!sc || sc.status !== "report_ready") return NextResponse.json({ ready: false });
  try {
    await ensurePdf(sc.token, req.nextUrl.origin);
    return NextResponse.json({ ready: true });
  } catch (err) {
    console.error("[pdf]", err);
    return NextResponse.json({ ready: false });
  }
}
