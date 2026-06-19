import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workoutSessions } from "@/db/schema";
import { sendMail } from "@/lib/mailer";
import { isAuthorizedCron } from "@/lib/cron";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

// "You haven't logged in a while" nudge. Honest + restrained: only users who HAVE
// trained (so we never spam new sign-ups), whose last qualifying session was 7–21 days
// ago (a real lapse, not an abandoned account), who haven't disabled gamification, and
// whose email is verified. The window upper-bound stops us nagging people who've moved on.
const LAPSE_MIN_DAYS = 7;
const LAPSE_MAX_DAYS = 21;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let sent = 0;
  try {
    const candidates = await db
      .select({
        email: users.email,
        lastSession: sql<string | null>`max(${workoutSessions.sessionDate}) filter (where ${workoutSessions.qualifies})`,
      })
      .from(users)
      .innerJoin(workoutSessions, eq(workoutSessions.userId, users.id))
      .where(and(eq(users.gamificationOptOut, false), sql`${users.emailVerified} is not null`))
      .groupBy(users.id, users.email)
      .having(
        sql`max(${workoutSessions.sessionDate}) filter (where ${workoutSessions.qualifies}) between (current_date - ${LAPSE_MAX_DAYS} * interval '1 day') and (current_date - ${LAPSE_MIN_DAYS} * interval '1 day')`,
      );

    for (const c of candidates) {
      try {
        await sendMail({
          to: c.email,
          subject: "Your training is waiting",
          html: `<p>It's been a little while since your last logged session. Whenever you're ready, your program is right where you left off.</p><p><a href="https://scorefit.net/log">Open your log →</a></p><p style="color:#888;font-size:12px">…but if you're beat or recovering, rest is part of the plan. You can turn these reminders off in account settings.</p>`,
          text: "It's been a little while since your last logged session. Your program is where you left off: https://scorefit.net/log — but if you're beat or recovering, rest is part of the plan.",
        });
        sent += 1;
      } catch (err) {
        await captureException(err, { where: "cron.reminders.send" });
      }
    }
  } catch (err) {
    await captureException(err, { where: "cron.reminders" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent }, { status: 200 });
}
