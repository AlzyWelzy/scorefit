import "server-only";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { userGameProfile, workoutSessions, challenges, challengeParticipants } from "@/db/schema";
import { weekStartOf, addDays } from "@/lib/time";
import { computeStreak } from "@/lib/game/streak";
import { currentSeasonId } from "@/lib/game/season";

// ─── Streak freezes ────────────────────────────────────────────────────────
// Scarce + non-stockpiling: earn 1 freeze per FREEZE_EARN_EVERY kept weeks, capped at
// FREEZE_CAP. At week-close, if the just-finished week was missed but the prior week was
// kept (i.e. an established streak about to break), auto-apply a freeze to bridge it.

const FREEZE_EARN_EVERY = 4;
const FREEZE_CAP = 2;

/**
 * Run at week close (cron) for one user: recompute their streak, award freezes for newly
 * accumulated kept weeks, and apply a freeze to bridge the just-finished week if it was
 * missed but would otherwise break an active streak. Idempotent per week (frozenWeeks is
 * a set; re-running won't double-apply).
 */
export async function closeWeekForUser(userId: string, today: string): Promise<{ froze: string | null }> {
  const [profile] = await db
    .select()
    .from(userGameProfile)
    .where(eq(userGameProfile.userId, userId))
    .limit(1);
  if (!profile) return { froze: null };

  const rows = await db
    .select({ sessionDate: workoutSessions.sessionDate })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.qualifies, true)));

  const frozen = new Set(profile.frozenWeeks ?? []);
  const summary = computeStreak(rows.map((r) => r.sessionDate), today, undefined, new Set(), frozen);

  // Award freezes: 1 per FREEZE_EARN_EVERY kept weeks since the last award, capped.
  let freezesAvailable = profile.freezesAvailable;
  let freezeKeptWeeks = profile.freezeKeptWeeks;
  const keptThisCycle = summary.currentStreak; // kept weeks in the active run
  if (keptThisCycle > freezeKeptWeeks) {
    const newlyKept = keptThisCycle - freezeKeptWeeks;
    const earned = Math.floor((freezeKeptWeeks + newlyKept) / FREEZE_EARN_EVERY) - Math.floor(freezeKeptWeeks / FREEZE_EARN_EVERY);
    freezesAvailable = Math.min(FREEZE_CAP, freezesAvailable + earned);
    freezeKeptWeeks = keptThisCycle;
  }

  // Apply a freeze to bridge the just-finished week if it was missed but the week before
  // it was kept (an active streak about to break) and a freeze is available.
  const justFinished = weekStartOf(addDays(weekStartOf(today), -7));
  const prior = weekStartOf(addDays(justFinished, -7));
  const cellByWeek = new Map(summary.weeks.map((w) => [w.weekStart, w]));
  const justCell = cellByWeek.get(justFinished);
  const priorCell = cellByWeek.get(prior);
  let froze: string | null = null;
  if (
    freezesAvailable > 0 &&
    justCell &&
    !justCell.kept &&
    priorCell?.kept &&
    !frozen.has(justFinished)
  ) {
    frozen.add(justFinished);
    freezesAvailable -= 1;
    froze = justFinished;
  }

  await db
    .update(userGameProfile)
    .set({
      freezesAvailable,
      freezeKeptWeeks,
      frozenWeeks: [...frozen],
      updatedAt: new Date(),
    })
    .where(eq(userGameProfile.userId, userId));

  return { froze };
}

// ─── Seasons + prestige ──────────────────────────────────────────────────────
// Competitive (season) XP resets quarterly; lifetime totalXp/level persist. currentSeasonId
// (pure, in lib/game/season.ts) is the calendar quarter. prestige is opt-in cosmetic.

/** Roll a user into the current season, resetting seasonXp when the quarter changes. */
export async function rolloverSeasonForUser(userId: string, today: string): Promise<void> {
  const season = currentSeasonId(today);
  await db
    .update(userGameProfile)
    .set({ seasonId: season, seasonXp: 0, updatedAt: new Date() })
    .where(and(eq(userGameProfile.userId, userId), sql`${userGameProfile.seasonId} is distinct from ${season}`));
}

// ─── Challenges ────────────────────────────────────────────────────────────
// One idempotent resolver across kinds. Freezes finalScore/finalRank at resolution so
// later log edits can't flip a settled result.

/** Resolve a single challenge: score each participant, rank, stamp resolvedAt. No-op if
 *  already resolved. Scoring is by kind; all use qualifying sessions in the window. */
export async function resolveChallenge(challengeId: string): Promise<{ resolved: boolean }> {
  const [ch] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!ch || ch.resolvedAt) return { resolved: false };

  const parts = await db
    .select({ userId: challengeParticipants.userId })
    .from(challengeParticipants)
    .where(eq(challengeParticipants.challengeId, challengeId));

  // Score = distinct qualifying training days in [startsOn, endsOn] (attendance — the
  // injury-neutral default for every kind; never weight/tonnage).
  const scored: { userId: string; score: number }[] = [];
  for (const p of parts) {
    const [row] = await db
      .select({
        n: sql<number>`count(distinct ${workoutSessions.sessionDate})::int`,
      })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, p.userId),
          eq(workoutSessions.qualifies, true),
          gte(workoutSessions.sessionDate, ch.startsOn),
          lte(workoutSessions.sessionDate, ch.endsOn),
        ),
      );
    scored.push({ userId: p.userId, score: row?.n ?? 0 });
  }

  scored.sort((a, b) => b.score - a.score);
  await db.transaction(async (tx) => {
    for (let i = 0; i < scored.length; i++) {
      await tx
        .update(challengeParticipants)
        .set({ finalScore: scored[i]!.score, finalRank: i + 1 })
        .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, scored[i]!.userId)));
    }
    await tx.update(challenges).set({ resolvedAt: new Date() }).where(eq(challenges.id, challengeId));
  });
  return { resolved: true };
}

/** Resolve all due (ended, unresolved) challenges. Returns count resolved. */
export async function resolveDueChallenges(today: string): Promise<number> {
  const due = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(isNull(challenges.resolvedAt), lte(challenges.endsOn, today)));
  let n = 0;
  for (const c of due) {
    const r = await resolveChallenge(c.id);
    if (r.resolved) n += 1;
  }
  return n;
}

/**
 * Ensure the auto-recurring weekly-consistency challenge exists for the current week and
 * the user is enrolled (the MVP everyone is implicitly in). Idempotent.
 */
export async function ensureWeeklyChallenge(userId: string, today: string): Promise<string> {
  const startsOn = weekStartOf(today);
  const endsOn = addDays(startsOn, 6);
  const title = `Weekly consistency · week of ${startsOn}`;

  // One shared weekly_consistency challenge per week (no group). Find or create.
  let [ch] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(eq(challenges.kind, "weekly_consistency"), eq(challenges.startsOn, startsOn), isNull(challenges.groupId)))
    .limit(1);
  if (!ch) {
    const [created] = await db
      .insert(challenges)
      .values({ kind: "weekly_consistency", title, startsOn, endsOn })
      .returning({ id: challenges.id });
    ch = created!;
  }
  await db
    .insert(challengeParticipants)
    .values({ challengeId: ch.id, userId })
    .onConflictDoNothing();
  return ch.id;
}
