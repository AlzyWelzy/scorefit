import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { GET as reconcile } from "@/app/api/cron/reconcile/route";
import { GET as reminders } from "@/app/api/cron/reminders/route";
import { GET as leaderboards } from "@/app/api/cron/leaderboards/route";
import { GET as purge } from "@/app/api/cron/purge/route";

export const runtime = "nodejs";

// Aggregated DAILY cron. Vercel's Hobby plan caps scheduled crons at 2 (daily frequency),
// so the individual daily jobs are fanned out from this single scheduled entry. Each
// underlying handler re-checks the shared CRON_SECRET, and a failure in one never blocks
// the others (idempotent jobs self-heal on the next run).
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const jobs: Record<string, () => Promise<Response>> = {
    reconcile: () => reconcile(req),
    reminders: () => reminders(req),
    leaderboards: () => leaderboards(req),
    purge: () => purge(req),
  };

  const status: Record<string, number> = {};
  for (const [name, run] of Object.entries(jobs)) {
    try {
      status[name] = (await run()).status;
    } catch {
      status[name] = 500;
    }
  }
  return NextResponse.json({ ok: true, jobs: status }, { status: 200 });
}
