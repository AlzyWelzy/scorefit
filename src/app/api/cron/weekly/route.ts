import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { GET as weekClose } from "@/app/api/cron/week-close/route";
import { GET as digest } from "@/app/api/cron/digest/route";

export const runtime = "nodejs";

// Aggregated WEEKLY cron (Mondays). Fans out the weekly jobs from one scheduled entry to
// stay within the Hobby cron limit; each underlying handler re-checks CRON_SECRET.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const jobs: Record<string, () => Promise<Response>> = {
    weekClose: () => weekClose(req),
    digest: () => digest(req),
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
