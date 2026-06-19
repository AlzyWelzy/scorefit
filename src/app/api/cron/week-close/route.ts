import { NextResponse } from "next/server";
import { db } from "@/db";
import { userGameProfile } from "@/db/schema";
import { closeWeekForUser, rolloverSeasonForUser, resolveDueChallenges } from "@/db/phase4";
import { isAuthorizedCron } from "@/lib/cron";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

// Phase 4 week-close (run weekly, e.g. Monday). For every user with a game profile:
// award/apply streak freezes for the just-finished week, and roll them into the current
// season (resetting seasonXp on a quarter change). Then resolve any challenges that ended.
// Best-effort per user; one failure never blocks the rest. Gated by CRON_SECRET.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // UTC date as the reference "today" — week-close runs on the week boundary; per-user
  // local nuance is bounded to a day and self-corrects on the next run.
  const today = new Date().toISOString().slice(0, 10);

  let froze = 0;
  let processed = 0;
  let challengesResolved = 0;
  try {
    const profiles = await db.select({ userId: userGameProfile.userId }).from(userGameProfile);
    for (const p of profiles) {
      try {
        const r = await closeWeekForUser(p.userId, today);
        if (r.froze) froze += 1;
        await rolloverSeasonForUser(p.userId, today);
        processed += 1;
      } catch (err) {
        await captureException(err, { where: "cron.weekClose.user", extra: { userId: p.userId } });
      }
    }
    challengesResolved = await resolveDueChallenges(today);
  } catch (err) {
    await captureException(err, { where: "cron.weekClose" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed, froze, challengesResolved }, { status: 200 });
}
