import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workoutSessions, prEvents, leaderboardCache } from "@/db/schema";
import { computeStreak } from "@/lib/game/streak";
import { mutualFollowIds } from "@/db/social";

// Leaderboards are computed on read from existing data (no materialized table) —
// fine for the current scale; materialize behind a cron if the opted-in population
// grows. Only the two PII-free, weight-fabrication-proof boards are exposed:
//   • Consistency %   — rolling 4-week kept-week consistency (capped at 100)
//   • Volume-PR count — number of honest (non-flagged) personal records
// Both rank self-relative/adherence metrics, so being big or lying about load can't
// win. Only users who explicitly opted in appear.

export type LeaderRow = { rank: number; name: string; value: number; isYou: boolean };

// Participant floor: don't expose a board until enough people have opted in, so early
// boards aren't a near-identifiable handful (privacy) and ranks are meaningful.
export const MIN_PARTICIPANTS = 5;

const displayFor = (u: { id: string; displayName: string | null }): string =>
  u.displayName?.trim() || `Lifter#${u.id.slice(0, 4)}`;

function optedInUsers() {
  return db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    // All must hold: an explicit board opt-in, gamification not disabled, AND no social
    // suspension. Opting out / being suspended both clear leaderboardOptIn, so the extra
    // predicates are belt-and-suspenders against any future write path that doesn't.
    .where(
      and(
        eq(users.leaderboardOptIn, true),
        eq(users.gamificationOptOut, false),
        isNull(users.suspendedSocialAt),
      ),
    );
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

function rankWithId(rows: { id: string; name: string; value: number }[], limit: number) {
  return rows
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, userId: r.id, name: r.name, value: r.value }));
}

// Read a materialized board from the cache. Returns null when the cache is empty (before
// the first cron run, or below the participant floor) so callers fall back to live compute.
async function cachedBoard(board: string, viewerId: string, limit: number): Promise<LeaderRow[] | null> {
  const rows = await db
    .select({
      rank: leaderboardCache.rank,
      userId: leaderboardCache.userId,
      name: leaderboardCache.name,
      value: leaderboardCache.value,
    })
    .from(leaderboardCache)
    .where(eq(leaderboardCache.board, board))
    .orderBy(asc(leaderboardCache.rank))
    .limit(limit);
  if (rows.length === 0) return null;
  return rows.map((r) => ({ rank: r.rank, name: r.name, value: r.value, isYou: r.userId === viewerId }));
}

export async function getConsistencyBoard(viewerId: string, today: string, limit = 25): Promise<LeaderRow[]> {
  const cached = await cachedBoard("consistency", viewerId, limit);
  if (cached) return cached;
  const us = await optedInUsers();
  if (us.length < MIN_PARTICIPANTS) return [];
  const ids = us.map((u) => u.id);
  const sessions = await db
    .select({ userId: workoutSessions.userId, sessionDate: workoutSessions.sessionDate })
    .from(workoutSessions)
    .where(and(inArray(workoutSessions.userId, ids), eq(workoutSessions.qualifies, true)));
  const byUser = new Map<string, string[]>();
  for (const s of sessions) (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push(s.sessionDate);
  return rank(
    us.map((u) => ({ id: u.id, name: displayFor(u), value: Math.round(computeStreak(byUser.get(u.id) ?? [], today).rollingConsistency) })),
    viewerId,
    limit,
  );
}

export async function getPrCountBoard(viewerId: string, limit = 25): Promise<LeaderRow[]> {
  const cached = await cachedBoard("pr_count", viewerId, limit);
  if (cached) return cached;
  const us = await optedInUsers();
  if (us.length < MIN_PARTICIPANTS) return [];
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

/**
 * Rebuild the materialized global boards (consistency + PR count). Called hourly by cron;
 * the read path serves from this cache and only falls back to live compute when it's empty.
 */
export async function refreshLeaderboards(today: string): Promise<{ consistency: number; prCount: number }> {
  const us = await optedInUsers();
  if (us.length < MIN_PARTICIPANTS) {
    await db.delete(leaderboardCache); // below the floor → boards stay hidden (live path returns [])
    return { consistency: 0, prCount: 0 };
  }
  const ids = us.map((u) => u.id);

  const sessions = await db
    .select({ userId: workoutSessions.userId, sessionDate: workoutSessions.sessionDate })
    .from(workoutSessions)
    .where(and(inArray(workoutSessions.userId, ids), eq(workoutSessions.qualifies, true)));
  const byUser = new Map<string, string[]>();
  for (const s of sessions) (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push(s.sessionDate);
  const consRows = rankWithId(
    us.map((u) => ({ id: u.id, name: displayFor(u), value: Math.round(computeStreak(byUser.get(u.id) ?? [], today).rollingConsistency) })),
    100,
  );

  const counts = await db
    .select({ userId: prEvents.userId, n: sql<number>`count(*)::int` })
    .from(prEvents)
    .where(and(inArray(prEvents.userId, ids), eq(prEvents.flagged, false)))
    .groupBy(prEvents.userId);
  const nByUser = new Map(counts.map((c) => [c.userId, c.n]));
  const prRows = rankWithId(
    us.map((u) => ({ id: u.id, name: displayFor(u), value: nByUser.get(u.id) ?? 0 })),
    100,
  );

  await db.transaction(async (tx) => {
    await tx.delete(leaderboardCache);
    if (consRows.length)
      await tx
        .insert(leaderboardCache)
        .values(consRows.map((r) => ({ board: "consistency", rank: r.rank, userId: r.userId, name: r.name, value: r.value })));
    if (prRows.length)
      await tx
        .insert(leaderboardCache)
        .values(prRows.map((r) => ({ board: "pr_count", rank: r.rank, userId: r.userId, name: r.name, value: r.value })));
  });
  return { consistency: consRows.length, prCount: prRows.length };
}

/**
 * Friends-scoped consistency board: the viewer + their mutual-follow friends who have
 * opted in. No MIN_PARTICIPANTS floor (a friends board is inherently small and the
 * members already know each other), but still respects opt-in / suspension / opt-out.
 */
export async function getFriendsBoard(viewerId: string, today: string, limit = 25): Promise<LeaderRow[]> {
  const friendIds = await mutualFollowIds(viewerId);
  const scope = [viewerId, ...friendIds];
  const us = (await optedInUsers()).filter((u) => scope.includes(u.id));
  if (us.length === 0) return [];
  const ids = us.map((u) => u.id);
  const sessions = await db
    .select({ userId: workoutSessions.userId, sessionDate: workoutSessions.sessionDate })
    .from(workoutSessions)
    .where(and(inArray(workoutSessions.userId, ids), eq(workoutSessions.qualifies, true)));
  const byUser = new Map<string, string[]>();
  for (const s of sessions) (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push(s.sessionDate);
  return rank(
    us.map((u) => ({ id: u.id, name: displayFor(u), value: Math.round(computeStreak(byUser.get(u.id) ?? [], today).rollingConsistency) })),
    viewerId,
    limit,
  );
}
