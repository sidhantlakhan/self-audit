import { computeScores, maskMobile, routeFor } from "./scorecard.ts";
import { SAMPLE_ANSWERS, SAMPLE_DETAILS, SAMPLE_REPORT } from "./sample.ts";
import type { ResultData } from "@/components/result/ResultView";

const scores = computeScores(SAMPLE_ANSWERS);

/** The public sample report (landing page "View sample report"). */
export const SAMPLE_RESULT: ResultData = {
  title: `${SAMPLE_DETAILS.biz} · ${SAMPLE_DETAILS.city}`,
  illustrative: true,
  total: scores.total,
  pillars: scores.pillars,
  weakest: scores.weakest,
  band: scores.band,
  report: SAMPLE_REPORT,
  route: routeFor(SAMPLE_DETAILS.turnover),
  maskedWa: maskMobile(SAMPLE_DETAILS.wa),
  pdfHref: "/api/sample/pdf",
};
