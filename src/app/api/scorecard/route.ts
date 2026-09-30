import { NextResponse, type NextRequest } from "next/server";
import { limits } from "@/config/site";
import { countRecentStarts, createScorecard } from "@/lib/server/db";
import { deviceIdFrom, ipHashFrom, setDeviceCookie } from "@/lib/server/device";

/** Starts a new Scorecard, subject to the per-device and per-network daily limits. */
export async function POST(req: NextRequest) {
  const device = deviceIdFrom(req);
  const ipHash = ipHashFrom(req);
  const recent = await countRecentStarts(device.id, ipHash);
  const limited = recent.device >= limits.startsPerDevicePerDay || recent.ip >= limits.startsPerIpPerDay;
  const res = limited
    ? NextResponse.json({ error: "rate_limited" }, { status: 429 })
    : NextResponse.json({ token: (await createScorecard(device.id, ipHash)).token }, { status: 201 });
  if (device.isNew) setDeviceCookie(res, device.id);
  return res;
}
