import { NextResponse, type NextRequest } from "next/server";
import { limits } from "@/config/site";
import { getScorecard, reportsToRetry } from "@/lib/server/db";
import { deliver, generateReport } from "@/lib/server/pipeline";

export const maxDuration = 300;

/**
 * Background job (run every 5 minutes): retries reports the AI writer could
 * not finish, then sends each one on WhatsApp and email, as promised on the
 * "AI unavailable" result screen. Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const due = await reportsToRetry(limits.maxReportAttempts);
  const results = [];
  for (const sc of due) {
    const outcome = await generateReport(sc);
    let sent = null;
    if (outcome.ok) {
      const fresh = await getScorecard(sc.token);
      sent = fresh ? await deliver(fresh).catch((e: Error) => ({ error: e.message })) : null;
    }
    results.push({ id: sc.id, ok: outcome.ok, sent });
  }
  return NextResponse.json({ processed: results.length, results });
}
