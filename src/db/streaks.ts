import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workoutSessions } from "@/db/schema";
import { computeStreak, type StreakSummary } from "@/lib/game/streak";

/**
 * Kept-week streak + consistency for a user, computed on read from their qualifying
 * sessions (no cron, no extra tables). `today` is the user's LOCAL date.
 */
export async function getStreakSummary(userId: string, today: string): Promise<StreakSummary> {
  const rows = await db
    .select({ sessionDate: workoutSessions.sessionDate })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.qualifies, true)));
  return computeStreak(
    rows.map((r) => r.sessionDate),
    today,
  );
}
