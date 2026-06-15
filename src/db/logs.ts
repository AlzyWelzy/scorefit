import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workoutLogs, type WorkoutLog } from "@/db/schema";

// Thin repository so the persistence layer stays swappable behind these calls.

export async function getLogsForWeek(
  userId: string,
  program: string,
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

export async function getLogsForProgram(userId: string, program: string): Promise<WorkoutLog[]> {
  return db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.program, program)));
}

export type SetLogInput = {
  program: string;
  week: number;
  daySlug: string;
  exerciseSlug: string;
  setIndex: number;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  completed?: boolean;
};

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
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
