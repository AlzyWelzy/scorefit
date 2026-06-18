import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workoutSessions, prEvents } from "@/db/schema";
import { computeStreak } from "@/lib/game/streak";

// Leaderboards are computed on read from existing data (no materialized table) —
// fine for the current scale; materialize behind a cron if the opted-in population
// grows. Only the two PII-free, weight-fabrication-proof boards are exposed:
//   • Consistency %   — rolling 4-week kept-week consistency (capped at 100)
//   • Volume-PR count — number of honest (non-flagged) personal records
// Both rank self-relative/adherence metrics, so being big or lying about load can't
// win. Only users who explicitly opted in appear.

export type LeaderRow = { rank: number; name: string; value: number; isYou: boolean };

const displayFor = (u: { id: string; displayName: string | null }): string =>
  u.displayName?.trim() || `Lifter#${u.id.slice(0, 4)}`;

function optedInUsers() {
  return db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    // Both must hold: an explicit board opt-in AND gamification not disabled. Opting
    // out of gamification clears leaderboardOptIn, so this is belt-and-suspenders.
    .where(and(eq(users.leaderboardOptIn, true), eq(users.gamificationOptOut, false)));
}

function rank(
  rows: { id: string; name: string; value: number }[],
  viewerId: string,
  limit: number,
): LeaderRow[] {
  return rows
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, name: r.name, value: r.value, isYou: r.id === viewerId }));
}

export async function getConsistencyBoard(viewerId: string, today: string, limit = 25): Promise<LeaderRow[]> {
  const us = await optedInUsers();
  if (us.length === 0) return [];
  const ids = us.map((u) => u.id);
  const sessions = await db
    .select({ userId: workoutSessions.userId, sessionDate: workoutSessions.sessionDate })
    .from(workoutSessions)
    .where(and(inArray(workoutSessions.userId, ids), eq(workoutSessions.qualifies, true)));
  const byUser = new Map<string, string[]>();
  for (const s of sessions) (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push(s.sessionDate);
  return rank(
    us.map((u) => ({ id: u.id, name: displayFor(u), value: computeStreak(byUser.get(u.id) ?? [], today).rollingConsistency })),
    viewerId,
    limit,
  );
}

export async function getPrCountBoard(viewerId: string, limit = 25): Promise<LeaderRow[]> {
  const us = await optedInUsers();
  if (us.length === 0) return [];
  const ids = us.map((u) => u.id);
  const counts = await db
    .select({ userId: prEvents.userId, n: sql<number>`count(*)::int` })
    .from(prEvents)
    .where(and(inArray(prEvents.userId, ids), eq(prEvents.flagged, false)))
    .groupBy(prEvents.userId);
  const nByUser = new Map(counts.map((c) => [c.userId, c.n]));
  return rank(
    us.map((u) => ({ id: u.id, name: displayFor(u), value: nByUser.get(u.id) ?? 0 })),
    viewerId,
    limit,
  );
}
