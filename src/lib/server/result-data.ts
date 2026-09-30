import "server-only";
import { bandFor, computeScores, maskMobile, routeFor } from "@/lib/scorecard";
import type { ResultData } from "@/components/result/ResultView";
import type { Scorecard } from "./db";

export function resultDataFor(sc: Scorecard): ResultData {
  const scores = computeScores(sc.answers);
  return {
    title: `${sc.details.biz} · ${sc.details.city}`,
    illustrative: false,
    total: scores.total,
    pillars: scores.pillars,
    weakest: scores.weakest,
    band: bandFor(scores.total).key,
    report: sc.status === "report_ready" ? sc.report : null,
    route: routeFor(sc.details.turnover),
    maskedWa: maskMobile(sc.details.wa),
    token: sc.token,
    pdfHref: sc.status === "report_ready" ? `/api/scorecard/${sc.token}/pdf` : null,
  };
}
