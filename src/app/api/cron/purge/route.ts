import { NextResponse } from "next/server";
import { purgeScheduledDeletions } from "@/db/users";
import { isAuthorizedCron, withCronTimeout } from "@/lib/cron";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

// Daily: hard-delete accounts whose GDPR deletion grace window has elapsed.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const deleted = await withCronTimeout("purge", () => purgeScheduledDeletions());
    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (err) {
    await captureException(err, { where: "cron.purge" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
