import { z } from "zod";
import { PILLARS } from "./scorecard.ts";

/** What the AI writer returns. Scores are never part of it — they come from fixed rules. */
export const ReportContentSchema = z.object({
  meaning: z.string().describe("What the score means for this business, 45–70 words, plain Indian English."),
  gaps: z
    .array(
      z.object({
        pillar: z.enum(PILLARS.map((p) => p.name) as [string, ...string[]]),
        gap: z.string().describe("The gap, as a short headline under 9 words."),
        why: z.string().describe("Why it matters for AI, one or two sentences, under 30 words."),
      }),
    )
    .length(3),
  useCases: z
    .array(
      z.object({
        name: z.string().describe("The AI use case, under 8 words."),
        mustExistFirst: z.string().describe("What must exist in the business first, one sentence under 20 words."),
        effort: z.enum(["Low", "Medium", "High"]),
      }),
    )
    .length(3),
  actions: z
    .array(z.string().describe("A concrete first action the founder can start this week, one sentence under 20 words."))
    .length(3),
});

export type ReportContent = z.infer<typeof ReportContentSchema>;

export type Effort = ReportContent["useCases"][number]["effort"];
