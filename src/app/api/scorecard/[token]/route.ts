import { NextResponse } from "next/server";
import { z } from "zod";
import { OPEN_TEXT_MAX, SOFTWARE, answeredCount, sanitiseAnswers } from "@/lib/scorecard";
import { getScorecard, saveDraft } from "@/lib/server/db";

type Ctx = { params: Promise<{ token: string }> };

function publicView(sc: NonNullable<Awaited<ReturnType<typeof getScorecard>>>) {
  return {
    status: sc.status,
    details: sc.details,
    answers: sc.answers,
    open: sc.open,
    voiceUsed: sc.voiceUsed,
    answered: answeredCount(sc.answers),
    updatedAt: sc.updatedAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: Ctx) {
  const sc = await getScorecard((await params).token);
  if (!sc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(publicView(sc));
}

const text = (max: number) => z.string().max(max).transform((s) => s.trim() === "" ? "" : s);

const Patch = z.object({
  details: z
    .object({
      name: text(120), biz: text(160), industry: text(60), city: text(80), turnover: text(40), team: text(20),
      wa: text(20), email: text(160), consent: z.boolean(),
    })
    .optional(),
  answers: z.array(z.unknown()).max(25).optional(),
  open: z
    .object({
      bottleneck: z.string().max(OPEN_TEXT_MAX),
      software: z.array(z.enum(SOFTWARE)).max(SOFTWARE.length),
      automate: z.string().max(OPEN_TEXT_MAX),
    })
    .optional(),
  voiceUsed: z.object({ bottleneck: z.boolean().optional(), automate: z.boolean().optional() }).optional(),
});

/** Autosave. */
export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { answers, ...rest } = parsed.data;
  const sc = await saveDraft((await params).token, { ...rest, answers: answers ? sanitiseAnswers(answers) : undefined });
  if (!sc) return NextResponse.json({ error: "locked_or_missing" }, { status: 409 });
  return NextResponse.json(publicView(sc));
}
