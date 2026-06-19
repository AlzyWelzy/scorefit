import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  workoutLogs,
  workoutSessions,
  userGameProfile,
  xpEvents,
  userAchievements,
  achievementProgress,
  prEvents,
} from "@/db/schema";
import { buildWeekCoordinates, weekCount, getExercise, isDeload, type ProgramId } from "@/lib/data";
import { archetypeFor, equipmentFor } from "@/lib/movement";
import { e1rm } from "@/lib/strength";
import { weekStartOf, addDays } from "@/lib/time";
import { levelForXp, titleForLevel } from "@/lib/game/levels";
import { XP, setCompletionXpDecayed, logQualityXp, prCooldownOk, applyDailyCap, PR_MAX_GAIN_PCT, PR_COOLDOWN_DAYS, CADENCE_XP, PERFECT_WEEK_DAYS, PERFECT_WEEK_XP } from "@/lib/game/xp";
import { ACHIEVEMENTS, type AchievementContext, type AchievementTier } from "@/lib/game/achievements";

const LB_TO_KG = 0.45359237;

// The week-qualified set of valid prescribed coordinates per program, memoized from
// static program data. Used to count only PRESCRIBED completed sets — extra/stale
// coords never drive XP, completion %, or collection/volume badges.
const programValidCoords = new Map<ProgramId, Set<string>>();
function validCoordsFor(program: ProgramId): Set<string> {
  const cached = programValidCoords.get(program);
  if (cached) return cached;
  const set = new Set<string>();
  for (let w = 1; w <= weekCount(program); w++) {
    for (const k of buildWeekCoordinates(program, w).coordKeys) set.add(`${w}|${k}`);
  }
  programValidCoords.set(program, set);
  return set;
}
const prescribedTotalFor = (program: ProgramId): number => validCoordsFor(program).size;

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const TIER_RANK: Record<string, number> = { bronze: 1, silver: 2, gold: 3 };
const tierRank = (t: string | null | undefined): number => (t ? (TIER_RANK[t] ?? 0) : 0);

type XpSource = "set_completion" | "log_quality" | "pr" | "achievement" | "cadence" | "perfect_week";
type XpRow = { source: XpSource; refKey: string; amount: number; eventDate: string };

export type GameEventInput = {
  program: ProgramId;
  week: number;
  daySlug: string;
  exerciseSlug: string;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
};

export type GameOutcome = {
  totalXp: number;
  level: number;
  title: string;
  leveledUpTo: number | null;
  newlyUnlocked: { id: string; title: string; tier: AchievementTier | null; hidden: boolean }[];
  newPr: { exerciseSlug: string; e1rm: number; gainPct: number | null } | null;
};

/**
 * The write-time gamification engine. Run after a set is saved (best-effort). One
 * transaction guarded by a per-USER advisory lock so concurrent set saves can't race
 * the recompute.
 *
 * Everything is recompute-from-source, not accumulate-forward, so edits and
 * un-completes self-heal:
 *  - XP rows are keyed (source, refKey) and UPSERTED with the current correct amount,
 *    so re-saving never double-pays and un-completing drops set/log/PR XP to 0.
 *    totalXp = SUM(amount), always rebuildable from the ledger.
 *  - The per-exercise best e1RM is recomputed from completed logs each time (a typo'd
 *    set that's later corrected stops poisoning the best), and PR XP is "does a
 *    plausible record still stand" — so it reverses when the set is undone.
 *  - Achievement aggregates count only PRESCRIBED completed coords (extra/stale sets
 *    can't inflate them). Earned achievements are PERMANENT by design: their XP is a
 *    non-reversible floor on totalXp (you don't un-earn "First Lift").
 *
 * Health/anti-cheat: only completed in-prescription sets earn XP (extra sets pay 0);
 * log-quality XP is flat (never scales with load); PRs pay only inside a plausibility
 * band; raw weight is never an XP input; tonnage badges are normalized to kg.
 */
export async function evaluateGameEvents(
  userId: string,
  input: GameEventInput,
  ctx: { unit: "kg" | "lb"; eventDate: string },
): Promise<GameOutcome> {
  const { program, week, daySlug, exerciseSlug, setIndex } = input;
  const eventDate = ctx.eventDate;
  const coordKey = `${program}|${week}|${daySlug}|${exerciseSlug}|${setIndex}`;
  const isPrescribed = validCoordsFor(program).has(`${week}|${daySlug}|${exerciseSlug}|${setIndex}`);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`game:${userId}`}, 0))`);

    const [profileRow] = await tx
      .select()
      .from(userGameProfile)
      .where(eq(userGameProfile.userId, userId))
      .limit(1);
    const bestMap: Record<string, { e1rm: number; at: string }> = { ...(profileRow?.bestE1rm ?? {}) };

    // Prescribed set count for THIS exercise (for junk-volume decay). The logger only
    // exposes prescribed coordinates today, so a set's setIndex ≤ count ⇒ full pay; the
    // decay only bites if extra-set logging is ever added. Computed from the canonical
    // coordinate space so it can't drift from /log or the session roll-up.
    let prescribedForExercise = 0;
    for (const d of buildWeekCoordinates(program, week).days) {
      if (d.slug !== daySlug) continue;
      for (const ex of d.exercises) if (ex.slug === exerciseSlug) prescribedForExercise = ex.sets;
    }

    // ---- XP: set-completion + log-quality (idempotent; amount reflects current state) ----
    const xpRows: XpRow[] = [
      {
        source: "set_completion",
        refKey: coordKey,
        amount: setCompletionXpDecayed({
          completed: input.completed,
          isPrescribed,
          position: setIndex,
          prescribedCount: prescribedForExercise,
        }),
        eventDate,
      },
      {
        source: "log_quality",
        refKey: coordKey,
        amount: logQualityXp({ completed: input.completed, weight: input.weight, reps: input.reps, rpe: input.rpe }),
        eventDate,
      },
    ];

    // ---- fetch all completed logs once; drives PR best + achievement aggregates ----
    const completedLogs = await tx
      .select({
        program: workoutLogs.program,
        week: workoutLogs.week,
        daySlug: workoutLogs.daySlug,
        exerciseSlug: workoutLogs.exerciseSlug,
        setIndex: workoutLogs.setIndex,
        weight: workoutLogs.weight,
        reps: workoutLogs.reps,
        rpe: workoutLogs.rpe,
      })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.completed, true)));

    // ---- PR detection (recompute the exercise's best from completed logs) ----
    let newPr: GameOutcome["newPr"] = null;
    let bestNow = 0;
    for (const l of completedLogs) {
      if (l.exerciseSlug === exerciseSlug && l.weight != null && l.reps != null && l.weight > 0 && l.reps > 0) {
        bestNow = Math.max(bestNow, e1rm(l.weight, l.reps));
      }
    }
    const prevBest = bestMap[exerciseSlug]?.e1rm ?? null;
    if (bestNow > 0 && prevBest != null && bestNow > prevBest) {
      const gainPct = ((bestNow - prevBest) / prevBest) * 100;
      const implausible = gainPct > PR_MAX_GAIN_PCT;
      await tx
        .insert(prEvents)
        .values({ userId, exerciseSlug, kind: "e1rm", value: bestNow, gainPct, occurredOn: eventDate, flagged: implausible })
        .onConflictDoUpdate({
          target: [prEvents.userId, prEvents.exerciseSlug, prEvents.occurredOn, prEvents.kind],
          set: { value: sql`excluded.value`, gainPct: sql`excluded.gain_pct`, flagged: sql`excluded.flagged` },
        });
      if (!implausible) newPr = { exerciseSlug, e1rm: bestNow, gainPct };
    }
    // Store the recomputed best — raises OR lowers, so a corrected typo self-heals.
    if (bestNow > 0) bestMap[exerciseSlug] = { e1rm: bestNow, at: eventDate };
    else delete bestMap[exerciseSlug];

    // PR XP: a flat per-exercise reward, paid at most once per PR_COOLDOWN_DAYS so a
    // burst of small day-over-day "records" can't farm XP. Keyed per OCCURRENCE DATE
    // (pr:slug:date), not just per exercise, so each window's legitimate first PR keeps
    // its own ledger row — re-saving that day's set re-pays the same row idempotently,
    // and undoing the set drops it to 0. The cooldown is evaluated against OTHER paid
    // pr rows for this exercise (from the ledger, not wall-clock) so it's deterministic.
    // The base reward stands only while the current best still meets the best plausible
    // record on file (so it reverses to 0 if the set is later undone).
    const [recRow] = await tx
      .select({ rec: sql<number | null>`max(${prEvents.value}) filter (where not ${prEvents.flagged})` })
      .from(prEvents)
      .where(and(eq(prEvents.userId, userId), eq(prEvents.exerciseSlug, exerciseSlug)));
    const recordedPlausible = recRow?.rec ?? null;
    const prRefKey = `pr:${exerciseSlug}:${eventDate}`;
    const recordStands = recordedPlausible != null && bestNow >= recordedPlausible;
    // Dates of OTHER already-paid PR bonuses for this exercise inside the cooldown
    // window; the pure prCooldownOk() decides whether this one is far enough past them.
    const priorPaid = recordStands
      ? await tx
          .select({ at: xpEvents.eventDate })
          .from(xpEvents)
          .where(
            and(
              eq(xpEvents.userId, userId),
              eq(xpEvents.source, "pr"),
              sql`${xpEvents.refKey} like ${`pr:${exerciseSlug}:%`}`,
              sql`${xpEvents.refKey} <> ${prRefKey}`,
              sql`${xpEvents.amount} > 0`,
              sql`${xpEvents.eventDate} < ${eventDate}::date`,
              sql`${xpEvents.eventDate} > (${eventDate}::date - ${PR_COOLDOWN_DAYS} * interval '1 day')`,
            ),
          )
      : [];
    const cooldownOk = prCooldownOk(priorPaid.map((r) => r.at), eventDate);
    xpRows.push({
      source: "pr",
      refKey: prRefKey,
      amount: recordStands && cooldownOk ? XP.pr : 0,
      eventDate,
    });

    // ---- achievement context (PRESCRIBED completed coords only) ----
    let totalCompletedSets = 0;
    let lifetimeTonnageRaw = 0;
    let rpeSetCount = 0;
    let pushSets = 0;
    let pullSets = 0;
    const distinctEx = new Set<string>();
    const archetypes = new Set<string>();
    const equipment = new Set<string>();
    const deloadWeeksKept = new Set<string>(); // `${program}:${week}` for deload weeks trained
    const completedByProgram: Record<string, number> = { beginner: 0, intermediate: 0 };
    for (const l of completedLogs) {
      if (!validCoordsFor(l.program).has(`${l.week}|${l.daySlug}|${l.exerciseSlug}|${l.setIndex}`)) continue;
      totalCompletedSets += 1;
      distinctEx.add(l.exerciseSlug);
      if (l.weight != null && l.reps != null) lifetimeTonnageRaw += l.weight * l.reps;
      completedByProgram[l.program] = (completedByProgram[l.program] ?? 0) + 1;
      if (isDeload(l.week)) deloadWeeksKept.add(`${l.program}:${l.week}`);
      if (l.rpe != null && l.rpe >= 5 && l.rpe <= 10) rpeSetCount += 1;
      // Breadth + push/pull balance: classify by exercise NAME (the heuristics are
      // name-based). Unknown slugs fall through to "static"/default, harmless here.
      const name = getExercise(l.exerciseSlug)?.name ?? l.exerciseSlug;
      const arch = archetypeFor(name);
      archetypes.add(arch);
      equipment.add(equipmentFor(name));
      if (arch === "press" || arch === "triceps") pushSets += 1;
      else if (arch === "pull" || arch === "curl") pullSets += 1;
    }
    const lifetimeTonnage = ctx.unit === "lb" ? lifetimeTonnageRaw * LB_TO_KG : lifetimeTonnageRaw;

    const [sess] = await tx
      .select({
        distinctDays: sql<number>`count(distinct ${workoutSessions.sessionDate}) filter (where ${workoutSessions.qualifies})::int`,
        priorDate: sql<string | null>`max(${workoutSessions.sessionDate}) filter (where ${workoutSessions.qualifies} and not ${workoutSessions.backfilled} and ${workoutSessions.sessionDate} < ${eventDate}::date)`,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, userId));

    const [prCount] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(prEvents)
      .where(and(eq(prEvents.userId, userId), eq(prEvents.flagged, false)));

    const achCtx: AchievementContext = {
      distinctExercises: distinctEx.size,
      totalCompletedSets,
      lifetimeTonnage,
      distinctTrainingDays: sess?.distinctDays ?? 0,
      programCompletion: {
        beginner: Math.min(1, (completedByProgram["beginner"] ?? 0) / Math.max(1, prescribedTotalFor("beginner"))),
        intermediate: Math.min(1, (completedByProgram["intermediate"] ?? 0) / Math.max(1, prescribedTotalFor("intermediate"))),
      },
      hasAnyPr: (prCount?.n ?? 0) > 0,
      daysSinceLastSession: sess?.priorDate ? daysBetween(sess.priorDate, eventDate) : null,
      unit: ctx.unit,
      distinctArchetypes: archetypes.size,
      distinctEquipment: equipment.size,
      rpeSetCount,
      pushSets,
      pullSets,
      deloadWeeksKept: deloadWeeksKept.size,
    };

    // ---- evaluate achievements (earned ones are permanent: never downgraded/removed) ----
    const existing = await tx
      .select({ achievementId: userAchievements.achievementId, tier: userAchievements.tier })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));
    const existingMap = new Map(existing.map((e) => [e.achievementId, e.tier]));

    const progressRows: {
      userId: string;
      key: string;
      progressValue: number;
      progressMax: number | null;
      meta: Record<string, unknown> | null;
    }[] = [];
    const unlockRows: {
      userId: string;
      achievementId: string;
      tier: AchievementTier | null;
      evidence: Record<string, unknown> | null;
    }[] = [];
    const newlyUnlocked: GameOutcome["newlyUnlocked"] = [];

    for (const rule of ACHIEVEMENTS) {
      const res = rule.evaluate(achCtx);
      progressRows.push({
        userId,
        key: rule.progressKey,
        progressValue: res.progressValue,
        progressMax: res.progressMax ?? null,
        meta: res.evidence ?? null,
      });
      if (!res.unlocked) continue;
      const isNew = !existingMap.has(rule.id);
      const isUpgrade = !isNew && tierRank(res.tier) > tierRank(existingMap.get(rule.id));
      if (isNew || isUpgrade) {
        unlockRows.push({ userId, achievementId: rule.id, tier: res.tier, evidence: res.evidence ?? null });
        // ONE XP row per achievement (refKey is tier-independent), tier-scaled and
        // upserted — so a bronze→gold climb ends at the gold amount, never stacks.
        xpRows.push({
          source: "achievement",
          refKey: `ach:${rule.id}`,
          amount: XP.achievement * Math.max(1, tierRank(res.tier)),
          eventDate,
        });
        newlyUnlocked.push({ id: rule.id, title: rule.title, tier: res.tier, hidden: !!rule.hidden });
      }
    }

    // ---- weekly cadence XP (the consistency reward; idempotent + self-healing per week) ----
    const weekStart = weekStartOf(eventDate);
    const [wk] = await tx
      .select({
        days: sql<number>`count(distinct ${workoutSessions.sessionDate}) filter (where ${workoutSessions.qualifies})::int`,
      })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          sql`${workoutSessions.sessionDate} between ${weekStart}::date and ${addDays(weekStart, 6)}::date`,
        ),
      );
    const weekDays = wk?.days ?? 0;
    xpRows.push({
      source: "cadence",
      refKey: `cadence:${weekStart}`,
      amount: CADENCE_XP[Math.min(weekDays, CADENCE_XP.length - 1)]!,
      eventDate,
    });
    xpRows.push({
      source: "perfect_week",
      refKey: `perfectweek:${weekStart}`,
      amount: weekDays >= PERFECT_WEEK_DAYS ? PERFECT_WEEK_XP : 0,
      eventDate,
    });

    // ---- persist progress + unlocks + all XP (batched upserts) ----
    if (progressRows.length) {
      await tx
        .insert(achievementProgress)
        .values(progressRows)
        .onConflictDoUpdate({
          target: [achievementProgress.userId, achievementProgress.key],
          set: {
            progressValue: sql`excluded.progress_value`,
            progressMax: sql`excluded.progress_max`,
            meta: sql`excluded.meta`,
            updatedAt: sql`now()`,
          },
        });
    }
    if (unlockRows.length) {
      await tx
        .insert(userAchievements)
        .values(unlockRows)
        .onConflictDoUpdate({
          target: [userAchievements.userId, userAchievements.achievementId],
          set: { tier: sql`excluded.tier` },
        });
    }
    await tx
      .insert(xpEvents)
      .values(xpRows.map((r) => ({ userId, source: r.source, refKey: r.refKey, amount: r.amount, eventDate: r.eventDate })))
      .onConflictDoUpdate({
        target: [xpEvents.userId, xpEvents.source, xpEvents.refKey],
        set: { amount: sql`excluded.amount`, eventDate: sql`excluded.event_date` },
      });

    // ---- recompute the denormalized profile from the ledger ----
    // Daily cap is applied to the RATE-LIMITED sources (set/log-quality/PR) per event
    // date, then the capped per-day subtotals are summed with the un-rate-limited
    // sources (cadence/perfect-week/achievement, already weekly/once). Done over the
    // ledger so totalXp stays a pure, self-healing function of the events.
    // Rate-limited sources = set_completion, log_quality, pr (capped per day).
    const perDay = await tx
      .select({
        eventDate: xpEvents.eventDate,
        rateLimited: sql<number>`coalesce(sum(${xpEvents.amount}) filter (where ${xpEvents.source} in ('set_completion','log_quality','pr')), 0)::int`,
        uncapped: sql<number>`coalesce(sum(${xpEvents.amount}) filter (where ${xpEvents.source} not in ('set_completion','log_quality','pr')), 0)::int`,
      })
      .from(xpEvents)
      .where(eq(xpEvents.userId, userId))
      .groupBy(xpEvents.eventDate);
    let totalXp = 0;
    for (const d of perDay) totalXp += applyDailyCap(Math.max(0, d.rateLimited)) + d.uncapped;
    const level = levelForXp(totalXp);
    const title = titleForLevel(level);
    const prevLevel = profileRow?.level ?? 1;

    await tx
      .insert(userGameProfile)
      .values({ userId, totalXp, level, title, bestE1rm: bestMap, updatedAt: sql`now()` })
      .onConflictDoUpdate({
        target: [userGameProfile.userId],
        set: { totalXp, level, title, bestE1rm: bestMap, updatedAt: sql`now()` },
      });

    return {
      totalXp,
      level,
      title,
      leveledUpTo: level > prevLevel ? level : null,
      newlyUnlocked,
      newPr,
    };
  });
}

// ─── Read helpers for /profile and /achievements ────────────────────────────

export async function getGameProfile(userId: string) {
  const [row] = await db.select().from(userGameProfile).where(eq(userGameProfile.userId, userId)).limit(1);
  return row ?? null;
}

/** Lifetime XP grouped by source, for the "where your XP came from" breakdown. */
export async function getXpBreakdown(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ source: xpEvents.source, total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int` })
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId))
    .groupBy(xpEvents.source);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.source] = r.total;
  return out;
}

export async function getUserAchievements(userId: string) {
  return db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
}

export async function getAchievementProgress(userId: string) {
  return db.select().from(achievementProgress).where(eq(achievementProgress.userId, userId));
}

/**
 * Rarity per achievement = % of players who hold it. Computed at read time (no stored
 * rarity to drift): unlock count per achievementId over the count of players who have
 * any game profile (the "active player" denominator). Returns 0..100 by achievementId.
 */
export async function getAchievementRarity(): Promise<Record<string, number>> {
  const [{ players } = { players: 0 }] = await db
    .select({ players: sql<number>`count(*)::int` })
    .from(userGameProfile);
  if (!players) return {};
  const counts = await db
    .select({ achievementId: userAchievements.achievementId, n: sql<number>`count(*)::int` })
    .from(userAchievements)
    .groupBy(userAchievements.achievementId);
  const out: Record<string, number> = {};
  for (const c of counts) out[c.achievementId] = Math.round((c.n / players) * 100);
  return out;
}
