import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { workoutLogs, workoutSessions } from "@/db/schema";
import { buildWeekCoordinates, type ProgramId } from "@/lib/data";
import { e1rm } from "@/lib/strength";
import { resolveLocalDate } from "@/lib/time";

// A program-day "qualifies" as a real training session above this honesty floor,
// computed from completed sets only (never from self-reported weight), so a single
// stray tap can't bank a day toward streaks/leaderboards.
const QUALIFY_MIN_SETS = 3;
const QUALIFY_MIN_EXERCISES = 2;

type SessionContext = { tz?: string; loggedAt?: string };

/**
 * Recompute and upsert the derived workout_sessions row for one program-day from
 * its completed logs. Called after a set is saved. Idempotent. sessionDate is the
 * user's LOCAL date, set only on first insert and never moved afterward (editing an
 * old set never re-dates the session). If the day has no completed sets left, the
 * session row is removed.
 *
 * Concurrency: the whole read→write runs in a transaction guarded by an advisory
 * lock keyed on the program-day, so two concurrent saves for the same day (a
 * debounced edit racing the periodic outbox flush, or two devices) serialize and
 * the recompute can't persist a stale aggregate or wrongly delete a live session.
 */
export async function syncSessionForLog(
  userId: string,
  program: ProgramId,
  week: number,
  daySlug: string,
  ctx: SessionContext = {},
): Promise<void> {
  const sessionDate = resolveLocalDate(ctx.tz, ctx.loggedAt);
  const lockKey = `session:${userId}:${program}:${week}:${daySlug}`;

  await db.transaction(async (tx) => {
    // Serialize all syncs for this coordinate (released on commit). hashtextextended
    // maps the coordinate string to the bigint the lock takes.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

    const completed = await tx
      .select({
        exerciseSlug: workoutLogs.exerciseSlug,
        weight: workoutLogs.weight,
        reps: workoutLogs.reps,
      })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          eq(workoutLogs.program, program),
          eq(workoutLogs.week, week),
          eq(workoutLogs.daySlug, daySlug),
          eq(workoutLogs.completed, true),
        ),
      );

    // No completed work left for this day — drop any session so an emptied day
    // doesn't linger as a "trained" date.
    if (completed.length === 0) {
      await tx
        .delete(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, userId),
            eq(workoutSessions.program, program),
            eq(workoutSessions.week, week),
            eq(workoutSessions.daySlug, daySlug),
          ),
        );
      return;
    }

    const exercises = new Set<string>();
    let tonnage = 0;
    let best = 0;
    for (const r of completed) {
      exercises.add(r.exerciseSlug);
      if (r.weight != null && r.reps != null) {
        tonnage += r.weight * r.reps;
        if (r.weight > 0 && r.reps > 0) best = Math.max(best, e1rm(r.weight, r.reps));
      }
    }
    const distinctExercises = exercises.size;
    const completedSets = completed.length;
    const qualifies =
      completedSets >= QUALIFY_MIN_SETS || distinctExercises >= QUALIFY_MIN_EXERCISES;
    const prescribedSets =
      buildWeekCoordinates(program, week).days.find((d) => d.slug === daySlug)
        ?.exercises.reduce((sum, ex) => sum + ex.sets, 0) ?? 0;

    await tx
      .insert(workoutSessions)
      .values({
        userId,
        program,
        week,
        daySlug,
        sessionDate,
        distinctExercises,
        completedSets,
        prescribedSets,
        tonnage,
        bestE1rm: best > 0 ? best : null,
        qualifies,
        firstAt: sql`now()`,
        lastAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [
          workoutSessions.userId,
          workoutSessions.program,
          workoutSessions.week,
          workoutSessions.daySlug,
        ],
        // sessionDate is intentionally omitted — frozen on first write.
        set: {
          distinctExercises,
          completedSets,
          prescribedSets,
          tonnage,
          bestE1rm: best > 0 ? best : null,
          qualifies,
          lastAt: sql`now()`,
        },
      });
  });
}

/**
 * Whether the dated session for this program-day currently clears the honesty floor.
 * Reads the derived projection (not raw logs), so it reflects the same `qualifies` the
 * roll-up computed. Drives the "trained" (session_completed) feed event.
 */
export async function getSessionQualifies(
  userId: string,
  program: ProgramId,
  week: number,
  daySlug: string,
): Promise<boolean> {
  const [row] = await db
    .select({ qualifies: workoutSessions.qualifies })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.program, program),
        eq(workoutSessions.week, week),
        eq(workoutSessions.daySlug, daySlug),
      ),
    )
    .limit(1);
  return !!row?.qualifies;
}
