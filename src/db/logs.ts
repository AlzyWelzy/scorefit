import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { workoutLogs, type WorkoutLog } from "@/db/schema";
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
): Promise<Record<string, { weight: number | null; reps: number | null; week: number }>> {
  const rows = await db
    .select({
      exerciseSlug: workoutLogs.exerciseSlug,
      setIndex: workoutLogs.setIndex,
      weight: workoutLogs.weight,
      reps: workoutLogs.reps,
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
    .orderBy(desc(workoutLogs.week), desc(workoutLogs.weight));

  // First row per (exercise|setIndex) wins: week-descending, then heaviest first
  // within a week, so the "last: N × R" hint reflects the documented heaviest set.
  const out: Record<string, { weight: number | null; reps: number | null; week: number }> = {};
  for (const r of rows) {
    const key = `${r.exerciseSlug}|${r.setIndex}`;
    if (!out[key]) out[key] = { weight: r.weight, reps: r.reps, week: r.week };
  }
  return out;
}

export async function upsertSetLog(userId: string, input: SetLogInput): Promise<WorkoutLog> {
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
  return row;
}
