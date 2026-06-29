import { NextResponse } from "next/server";
import { refreshLeaderboards } from "@/db/leaderboard";
import { isAuthorizedCron, withCronTimeout } from "@/lib/cron";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

// Hourly: rebuild the materialized consistency + PR-count boards so reads are O(1).
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await withCronTimeout("leaderboards", () => refreshLeaderboards(today));
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    await captureException(err, { where: "cron.leaderboards" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
