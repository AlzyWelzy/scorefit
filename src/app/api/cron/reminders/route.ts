import { NextResponse } from "next/server";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workoutSessions, notificationPreferences } from "@/db/schema";
import { sendMail } from "@/lib/mailer";
import { isAuthorizedCron, withCronTimeout } from "@/lib/cron";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

// "You haven't logged in a while" nudge. Honest + restrained: only users who HAVE
// trained (so we never spam new sign-ups), whose last qualifying session was 7–21 days
// ago (a real lapse, not an abandoned account), who haven't disabled gamification, and
// whose email is verified. The window upper-bound stops us nagging people who've moved on.
const LAPSE_MIN_DAYS = 7;
const LAPSE_MAX_DAYS = 21;
// Frequency cap: never re-nudge the same user within this many days.
const REMINDER_COOLDOWN_DAYS = 7;
// Quiet hours: skip a user whose LOCAL time is in [QUIET_START, QUIET_END) (no 4am pings).
const QUIET_START = 21; // 9pm
const QUIET_END = 8; // 8am

function inQuietHours(timezone: string): boolean {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(new Date()),
    );
    // Window wraps midnight (21..24 and 0..8).
    return hour >= QUIET_START || hour < QUIET_END;
  } catch {
    return false; // bad tz → don't suppress
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { sent, skippedQuiet } = await withCronTimeout("reminders", async () => {
    let sent = 0;
    let skippedQuiet = 0;
    const candidates = await db
      .select({
        id: users.id,
        email: users.email,
        timezone: users.timezone,
        lastSession: sql<string | null>`max(${workoutSessions.sessionDate}) filter (where ${workoutSessions.qualifies})`,
      })
      .from(users)
      .innerJoin(workoutSessions, eq(workoutSessions.userId, users.id))
      .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
      .where(
        and(
          eq(users.gamificationOptOut, false),
          sql`${users.emailVerified} is not null`,
          // Respect the user's notification preference (default-on when no row exists).
          or(isNull(notificationPreferences.reminders), eq(notificationPreferences.reminders, true)),
          // Frequency cap: not reminded within the cooldown.
          sql`(${users.lastReminderAt} is null or ${users.lastReminderAt} < now() - ${REMINDER_COOLDOWN_DAYS} * interval '1 day')`,
        ),
      )
      .groupBy(users.id, users.email, users.timezone)
      .having(
        sql`max(${workoutSessions.sessionDate}) filter (where ${workoutSessions.qualifies}) between (current_date - ${LAPSE_MAX_DAYS} * interval '1 day') and (current_date - ${LAPSE_MIN_DAYS} * interval '1 day')`,
      );

    for (const c of candidates) {
      if (inQuietHours(c.timezone)) {
        skippedQuiet += 1;
        continue; // try again next cron run when it's a civil hour for them
      }
      try {
        await sendMail({
          to: c.email,
          subject: "Your training is waiting",
          html: `<p>It's been a little while since your last logged session. Whenever you're ready, your program is right where you left off.</p><p><a href="https://scorefit.net/log">Open your log →</a></p><p style="color:#888;font-size:12px">…but if you're beat or recovering, rest is part of the plan. You can turn these reminders off in account settings.</p>`,
          text: "It's been a little while since your last logged session. Your program is where you left off: https://scorefit.net/log — but if you're beat or recovering, rest is part of the plan.",
        });
        // Stamp so the frequency cap holds across runs.
        await db.update(users).set({ lastReminderAt: new Date() }).where(eq(users.id, c.id));
        sent += 1;
      } catch (err) {
        await captureException(err, { where: "cron.reminders.send" });
      }
    }
    return { sent, skippedQuiet };
    });
    return NextResponse.json({ ok: true, sent, skippedQuiet }, { status: 200 });
  } catch (err) {
    await captureException(err, { where: "cron.reminders" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
