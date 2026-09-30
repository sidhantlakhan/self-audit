import type { NextRequest } from "next/server";
import { getScorecard } from "@/lib/server/db";
import { ensurePdf } from "@/lib/server/pipeline";

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const sc = await getScorecard((await params).token);
  if (!sc || sc.status !== "report_ready") return new Response("Not found", { status: 404 });
  try {
    const pdf = await ensurePdf(sc.token, req.nextUrl.origin);
    const name = `AI-Readiness-Scorecard-${sc.details.biz.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[pdf]", err);
    return new Response("The PDF could not be prepared. Please try again in a minute.", { status: 503 });
  }
}
