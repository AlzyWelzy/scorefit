import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workoutSessions, userGameProfile } from "@/db/schema";
import { computeStreak, type StreakSummary } from "@/lib/game/streak";
import { isDeload } from "@/lib/data";
import { weekStartOf } from "@/lib/time";

/**
 * Kept-week streak + consistency for a user, computed on read from their qualifying
 * sessions (no cron, no extra tables). `today` is the user's LOCAL date. Deload weeks
 * (per the program's week number) get a lowered keep-target so resting as prescribed
 * never breaks the streak.
 */
export async function getStreakSummary(userId: string, today: string): Promise<StreakSummary> {
  const [rows, profile] = await Promise.all([
    db
      .select({ sessionDate: workoutSessions.sessionDate, week: workoutSessions.week })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.qualifies, true))),
    db
      .select({ frozenWeeks: userGameProfile.frozenWeeks })
      .from(userGameProfile)
      .where(eq(userGameProfile.userId, userId))
      .limit(1),
  ]);

  // Calendar week-starts that contained a deload program-week. If a single calendar week
  // mixes deload + non-deload sessions (program boundary), treat it as deload (lenient).
  const deloadWeekStarts = new Set<string>();
  for (const r of rows) if (isDeload(r.week)) deloadWeekStarts.add(weekStartOf(r.sessionDate));

  const frozenWeekStarts = new Set(profile[0]?.frozenWeeks ?? []);

  return computeStreak(
    rows.map((r) => r.sessionDate),
    today,
    undefined,
    deloadWeekStarts,
    frozenWeekStarts,
  );
}
