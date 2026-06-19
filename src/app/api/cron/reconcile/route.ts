import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userGameProfile, xpEvents } from "@/db/schema";
import { applyDailyCap } from "@/lib/game/xp";
import { levelForXp, titleForLevel } from "@/lib/game/levels";
import { isAuthorizedCron } from "@/lib/cron";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

// Nightly reconcile: rebuild each profile's totalXp/level/title from the xp_events
// ledger (the source of truth), applying the same per-day cap as the live engine. The
// engine already self-heals on every write, so this is a drift backstop — if a crash
// ever left a profile stale, this corrects it. Idempotent.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let reconciled = 0;
  try {
    // Per (user, day): rate-limited subtotal (capped) + uncapped subtotal.
    const perDay = await db
      .select({
        userId: xpEvents.userId,
        eventDate: xpEvents.eventDate,
        rateLimited: sql<number>`coalesce(sum(${xpEvents.amount}) filter (where ${xpEvents.source} in ('set_completion','log_quality','pr')), 0)::int`,
        uncapped: sql<number>`coalesce(sum(${xpEvents.amount}) filter (where ${xpEvents.source} not in ('set_completion','log_quality','pr')), 0)::int`,
      })
      .from(xpEvents)
      .groupBy(xpEvents.userId, xpEvents.eventDate);

    const totals = new Map<string, number>();
    for (const d of perDay) {
      const add = applyDailyCap(Math.max(0, d.rateLimited)) + d.uncapped;
      totals.set(d.userId, (totals.get(d.userId) ?? 0) + add);
    }

    for (const [userId, totalXp] of totals) {
      const level = levelForXp(totalXp);
      const title = titleForLevel(level);
      await db
        .update(userGameProfile)
        .set({ totalXp, level, title, updatedAt: sql`now()` })
        .where(eq(userGameProfile.userId, userId));
      reconciled += 1;
    }
  } catch (err) {
    await captureException(err, { where: "cron.reconcile" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reconciled }, { status: 200 });
}
