import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exerciseSwaps } from "@/db/schema";
import type { ProgramId } from "@/lib/data";

export type SwapMap = Record<string, string>; // `${daySlug}|${originalSlug}` -> subSlug

/** All of a user's swaps for a program, keyed for O(1) lookup by day+original slug. */
export async function getSwaps(userId: string, program: ProgramId): Promise<SwapMap> {
  const rows = await db
    .select({ daySlug: exerciseSwaps.daySlug, originalSlug: exerciseSwaps.originalSlug, subSlug: exerciseSwaps.subSlug })
    .from(exerciseSwaps)
    .where(and(eq(exerciseSwaps.userId, userId), eq(exerciseSwaps.program, program)));
  const out: SwapMap = {};
  for (const r of rows) out[`${r.daySlug}|${r.originalSlug}`] = r.subSlug;
  return out;
}

/** Record a swap (upsert). Passing subSlug === originalSlug clears it (reset to original). */
export async function setSwap(
  userId: string,
  program: ProgramId,
  daySlug: string,
  originalSlug: string,
  subSlug: string,
): Promise<void> {
  if (subSlug === originalSlug) {
    await db
      .delete(exerciseSwaps)
      .where(
        and(
          eq(exerciseSwaps.userId, userId),
          eq(exerciseSwaps.program, program),
          eq(exerciseSwaps.daySlug, daySlug),
          eq(exerciseSwaps.originalSlug, originalSlug),
        ),
      );
    return;
  }
  await db
    .insert(exerciseSwaps)
    .values({ userId, program, daySlug, originalSlug, subSlug })
    .onConflictDoUpdate({
      target: [exerciseSwaps.userId, exerciseSwaps.program, exerciseSwaps.daySlug, exerciseSwaps.originalSlug],
      set: { subSlug, createdAt: new Date() },
    });
}
