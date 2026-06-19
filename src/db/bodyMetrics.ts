import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bodyMetrics, type BodyMetric } from "@/db/schema";

/** Upsert today's (or a given day's) bodyweight entry. One row per user per local day. */
export async function recordBodyWeight(
  userId: string,
  measuredOn: string,
  weight: number,
  note?: string | null,
): Promise<void> {
  await db
    .insert(bodyMetrics)
    .values({ userId, measuredOn, weight, note: note ?? null })
    .onConflictDoUpdate({
      target: [bodyMetrics.userId, bodyMetrics.measuredOn],
      set: { weight, note: note ?? null },
    });
}

/** Recent entries, newest first (default a quarter's worth for the trend). */
export async function getBodyWeightHistory(userId: string, limit = 90): Promise<BodyMetric[]> {
  return db
    .select()
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.measuredOn))
    .limit(limit);
}

export async function deleteBodyWeight(userId: string, measuredOn: string): Promise<void> {
  await db
    .delete(bodyMetrics)
    .where(and(eq(bodyMetrics.userId, userId), eq(bodyMetrics.measuredOn, measuredOn)));
}
