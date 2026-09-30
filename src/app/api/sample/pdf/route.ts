import type { NextRequest } from "next/server";
import { appUrl, renderPdf } from "@/lib/server/pdf";

export const maxDuration = 60;

let cached: Buffer | null = null;

/** PDF of the illustrative sample report (Kavya Industrial Supplies). */
export async function GET(req: NextRequest) {
  try {
    cached ??= await renderPdf(`${appUrl(req.nextUrl.origin)}/sample-report/print`);
    return new Response(new Uint8Array(cached), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Sample-AI-Readiness-Scorecard.pdf"' },
    });
  } catch (err) {
    console.error("[sample pdf]", err);
    return new Response("The PDF could not be prepared. Please try again in a minute.", { status: 503 });
  }
}
