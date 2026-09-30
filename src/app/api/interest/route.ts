import { NextResponse } from "next/server";
import { z } from "zod";
import { getScorecard, recordInterest } from "@/lib/server/db";

const Body = z.union([
  // From the result page: contact details come from the Scorecard itself.
  z.object({ kind: z.enum(["webinar", "audit_call", "self_audit"]), token: z.string() }),
  // From the landing page request form.
  z.object({
    kind: z.enum(["self_audit", "consultant_audit"]),
    name: z.string().trim().min(1).max(120),
    business: z.string().trim().min(1).max(160),
    phone: z
      .string()
      .transform((p) => p.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^(\+?91)?[6-9]\d{9}$/, "phone"))
      .transform((p) => p.replace(/^(\+?91)(?=\d{10}$)/, "")),
    email: z.string().trim().email().max(160),
  }),
]);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const b = parsed.data;
  if ("token" in b) {
    const sc = await getScorecard(b.token);
    if (!sc) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordInterest({ kind: b.kind, scorecardId: sc.id, name: sc.details.name, business: sc.details.biz, phone: sc.details.wa, email: sc.details.email });
  } else {
    await recordInterest(b);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
