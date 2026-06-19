import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { workoutLogs, type WorkoutLog } from "@/db/schema";
import { syncSessionForLog } from "@/db/sessions";
import { captureException } from "@/lib/observability";
import type { ProgramId } from "@/lib/data";

// Thin repository so the persistence layer stays swappable behind these calls.

export async function getLogsForWeek(
  userId: string,
  program: ProgramId,
  week: number,
): Promise<WorkoutLog[]> {
  return db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.program, program),
        eq(workoutLogs.week, week),
      ),
    );
}

export async function getLogsForProgram(userId: string, program: ProgramId): Promise<WorkoutLog[]> {
  return db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.program, program)));
}

export type SetLogInput = {
  program: ProgramId;
  week: number;
  daySlug: string;
  exerciseSlug: string;
  setIndex: number;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  completed?: boolean;
};

/**
 * Most recent prior entry for a given exercise+set (across earlier weeks of the
 * same program), so the logger can show "last: 100 × 8" progressive-overload
 * guidance. Returns the heaviest completed set from the most recent week before
 * `beforeWeek` where it was logged.
 */
export async function getPreviousLoads(
  userId: string,
  program: ProgramId,
  beforeWeek: number,
): Promise<Record<string, { weight: number | null; reps: number | null; rpe: number | null; week: number }>> {
  // DISTINCT ON (exercise_slug, set_index) keeps one row per coordinate; the ORDER BY
  // makes that the latest week's heaviest set (week desc, weight desc) — the dedup the
  // JS loop used to do, now in the DB. Backed by idx_log_prev_completed (partial,
  // WHERE completed = true) so the planner walks only completed rows. rpe feeds the
  // logger's RPE auto-regulation hint.
  const rows = await db
    .selectDistinctOn([workoutLogs.exerciseSlug, workoutLogs.setIndex], {
      exerciseSlug: workoutLogs.exerciseSlug,
      setIndex: workoutLogs.setIndex,
      weight: workoutLogs.weight,
      reps: workoutLogs.reps,
      rpe: workoutLogs.rpe,
      week: workoutLogs.week,
    })
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.program, program),
        sql`${workoutLogs.week} < ${beforeWeek}`,
        eq(workoutLogs.completed, true),
      ),
    )
    .orderBy(
      workoutLogs.exerciseSlug,
      workoutLogs.setIndex,
      desc(workoutLogs.week),
      desc(workoutLogs.weight),
    );

  const out: Record<string, { weight: number | null; reps: number | null; rpe: number | null; week: number }> = {};
  for (const r of rows) {
    out[`${r.exerciseSlug}|${r.setIndex}`] = { weight: r.weight, reps: r.reps, rpe: r.rpe, week: r.week };
  }
  return out;
}

export async function upsertSetLog(
  userId: string,
  input: SetLogInput,
  ctx: { timezone?: string; loggedAt?: string } = {},
): Promise<WorkoutLog> {
  const [row] = await db
    .insert(workoutLogs)
    .values({
      userId,
      program: input.program,
      week: input.week,
      daySlug: input.daySlug,
      exerciseSlug: input.exerciseSlug,
      setIndex: input.setIndex,
      weight: input.weight ?? null,
      reps: input.reps ?? null,
      rpe: input.rpe ?? null,
      completed: input.completed ?? false,
    })
    .onConflictDoUpdate({
      target: [
        workoutLogs.userId,
        workoutLogs.program,
        workoutLogs.week,
        workoutLogs.daySlug,
        workoutLogs.exerciseSlug,
        workoutLogs.setIndex,
      ],
      set: {
        weight: input.weight ?? null,
        reps: input.reps ?? null,
        rpe: input.rpe ?? null,
        completed: input.completed ?? false,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  if (!row) throw new Error("upsertSetLog: insert returned no row");

  // Maintain the derived dated-session projection (the foundation streaks /
  // leaderboards / feeds read from). Best-effort: the set is already saved, and a
  // failure here must never fail the write — a reconcile job can rebuild sessions
  // from workout_logs if this drifts.
  try {
    await syncSessionForLog(userId, input.program, input.week, input.daySlug, {
      tz: ctx.timezone,
      loggedAt: ctx.loggedAt,
    });
  } catch (err) {
    await captureException(err, {
      where: "sessions.sync",
      extra: { userId, program: input.program, week: input.week, daySlug: input.daySlug },
    });
  }

  return row;
}
