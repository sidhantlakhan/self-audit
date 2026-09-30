import "server-only";
import { computeScores } from "@/lib/scorecard";
import * as db from "./db";
import { writeReport, REPORT_MODEL } from "./report-ai";
import { appUrl, renderPdf } from "./pdf";
import { deliverReport, type Delivery } from "./notify";

export type ReportOutcome = { ok: true } | { ok: false; aiDown: true };

/** Writes the AI report for a scored Scorecard. Idempotent once the report exists. */
export async function generateReport(sc: db.Scorecard): Promise<ReportOutcome> {
  if (sc.status === "report_ready") return { ok: true };
  try {
    const report = await writeReport(sc, computeScores(sc.answers));
    await db.saveReport(sc.token, report, REPORT_MODEL);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[report] ${sc.token.slice(0, 6)}… failed: ${message}`);
    await db.markReportFailed(sc.token, message);
    return { ok: false, aiDown: true };
  }
}

/** Returns the cached PDF, rendering and caching it first if needed. */
export async function ensurePdf(token: string, origin?: string): Promise<Buffer> {
  const cached = await db.getPdf(token);
  if (cached) return cached;
  const pdf = await renderPdf(`${appUrl(origin)}/scorecard/result/${token}/print`);
  await db.savePdf(token, pdf);
  return pdf;
}

export async function deliver(sc: db.Scorecard, origin?: string): Promise<Delivery> {
  const pdf = await ensurePdf(sc.token, origin);
  const base = appUrl(origin);
  const result = await deliverReport(sc, pdf, `${base}/api/scorecard/${sc.token}/pdf`, `${base}/scorecard/result/${sc.token}`);
  await db.markSent(sc.token, result);
  if (result.errors.length) console.error(`[deliver] ${sc.token.slice(0, 6)}…: ${result.errors.join(" | ")}`);
  return result;
}
