import type { Answer, Details, OpenAnswers } from "./scorecard.ts";
import type { ReportContent } from "./report.ts";

/**
 * Kavya Industrial Supplies, Rajkot — the illustrative example used on the
 * landing page and the public sample report. Its answers score 9, 7, 5, 8, 9.
 */
export const SAMPLE_ANSWERS: Answer[] = [2, 1, 1, 3, 2, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 3, 2, 1, 1, 2];

export const SAMPLE_DETAILS: Details = {
  name: "Kiran Mehta",
  biz: "Kavya Industrial Supplies",
  industry: "Trading",
  city: "Rajkot",
  turnover: "₹3–10 crore",
  team: "8–20",
  wa: "9876543210",
  email: "kiran@kavya-industrial.example",
  consent: true,
};

export const SAMPLE_OPEN: OpenAnswers = {
  bottleneck: "Quotations wait for my approval. Dispatch slips by a day when the transporter is late.",
  software: ["Tally", "Excel / Google Sheets", "WhatsApp Business"],
  automate: "Sending order-status updates to customers on WhatsApp.",
};

export const SAMPLE_REPORT: ReportContent = {
  meaning:
    "Kavya runs on Kiran's time and memory. Data sits across Tally, Excel and WhatsApp, and most decisions wait for him. Before AI can help, three foundations are needed: written limits for routine decisions, a few core SOPs, and one clean customer and item list.",
  gaps: [
    {
      pillar: "Data",
      gap: "Records sit in Tally, Excel and WhatsApp",
      why: "AI can only work from what it can find. Scattered records give confident but wrong answers.",
    },
    {
      pillar: "Process",
      gap: "Key tasks are not written down",
      why: "AI follows steps. If the steps are unwritten, it will invent them.",
    },
    {
      pillar: "Numbers and Control",
      gap: "Results are checked only when the founder asks",
      why: "Without a weekly review, no one would notice if AI output went wrong.",
    },
  ],
  useCases: [
    { name: "Quotation assistant with discount rules", mustExistFirst: "Written discount limits and one clean item and price list.", effort: "Medium" },
    { name: "WhatsApp order-status updates", mustExistFirst: "Orders and dispatch entered the same day, in one place.", effort: "Medium" },
    { name: "Receivables follow-up reminders", mustExistFirst: "A current debtors ageing report and a written follow-up rule.", effort: "Low" },
  ],
  actions: [
    "Write discount limits: who can approve what, up to which amount.",
    "Write the dispatch steps as a one-page checklist and pin it in the warehouse.",
    "Merge the customer and item lists into one sheet, with one named owner.",
  ],
};
