import { NextResponse, type NextRequest } from "next/server";
import { getScorecard } from "@/lib/server/db";
import { sendResumeLink } from "@/lib/server/notify";
import { appUrl } from "@/lib/server/pdf";

/** "Save and exit": answers are already autosaved; this emails a resume link when we have an email. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const sc = await getScorecard((await params).token);
  if (!sc || sc.status !== "draft") return NextResponse.json({ emailed: false });
  if (!/^\S+@\S+\.\S+$/.test(sc.details.email)) return NextResponse.json({ emailed: false });
  try {
    await sendResumeLink(sc.details.email, sc.details.name, `${appUrl(req.nextUrl.origin)}/scorecard?resume=${sc.token}`);
    return NextResponse.json({ emailed: true });
  } catch (err) {
    console.error("[save-exit]", err);
    return NextResponse.json({ emailed: false });
  }
}
