import { NextResponse } from "next/server";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workoutSessions, notificationPreferences } from "@/db/schema";
import { sendWeeklyDigest } from "@/lib/mailer";
import { isAuthorizedCron, withCronTimeout } from "@/lib/cron";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

// Weekly progress digest (run Monday). Goes only to verified, gamification-on users who
// have the digest channel enabled AND trained in the last 7 days — never dormant accounts.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const sent = await withCronTimeout("digest", async () => {
      const rows = await db
        .select({
          email: users.email,
          unit: users.unit,
          sessions: sql<number>`count(*) filter (where ${workoutSessions.qualifies} and ${workoutSessions.sessionDate} >= current_date - 7)::int`,
          tonnage: sql<number>`coalesce(sum(${workoutSessions.tonnage}) filter (where ${workoutSessions.sessionDate} >= current_date - 7), 0)::float8`,
        })
        .from(users)
        .innerJoin(workoutSessions, eq(workoutSessions.userId, users.id))
        .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
        .where(
          and(
            eq(users.gamificationOptOut, false),
            sql`${users.emailVerified} is not null`,
            or(isNull(notificationPreferences.digest), eq(notificationPreferences.digest, true)),
          ),
        )
        .groupBy(users.id, users.email, users.unit)
        .having(
          sql`count(*) filter (where ${workoutSessions.qualifies} and ${workoutSessions.sessionDate} >= current_date - 7) > 0`,
        );

      let n = 0;
      for (const r of rows) {
        try {
          await sendWeeklyDigest(r.email, { sessions: r.sessions, tonnage: Math.round(r.tonnage), unit: r.unit });
          n += 1;
        } catch (err) {
          await captureException(err, { where: "cron.digest.send" });
        }
      }
      return n;
    });
    return NextResponse.json({ ok: true, sent }, { status: 200 });
  } catch (err) {
    await captureException(err, { where: "cron.digest" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
