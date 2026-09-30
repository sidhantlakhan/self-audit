import { NextResponse, type NextRequest } from "next/server";
import { maskMobile } from "@/lib/scorecard";
import { getScorecard } from "@/lib/server/db";
import { deliver } from "@/lib/server/pipeline";

export const maxDuration = 60;

/** "Send to WhatsApp": delivers the report on WhatsApp and by email. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const sc = await getScorecard((await params).token);
  if (!sc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (sc.status !== "report_ready") return NextResponse.json({ error: "report_not_ready" }, { status: 409 });
  try {
    const d = await deliver(sc, req.nextUrl.origin);
    return NextResponse.json({ whatsapp: d.whatsapp, email: d.email, to: maskMobile(sc.details.wa) });
  } catch (err) {
    console.error("[send]", err);
    return NextResponse.json({ whatsapp: false, email: false, to: maskMobile(sc.details.wa) });
  }
}
