// XP award schedule — pure calculators, no I/O. The whole point: reward COMPLETING
// THE PLAN and logging honestly, never doing more or lifting heavier. Two lifters of
// very different strength earn identical XP for the same completed, well-logged set.

export const XP = {
  /** Per completed PRESCRIBED working set. Sets beyond the prescription earn 0 —
   *  there is no incentive to grind junk volume (anti-overtraining by construction). */
  prescribedSet: 10,
  /** Flat bonus for a fully-logged set (weight + reps). Rewards record completeness,
   *  NOT magnitude, so there's zero pull toward inflating numbers. */
  fullLog: 2,
  /** Extra for an honest RPE in the sane 5–10 range. */
  rpeLog: 1,
  /** Progressive-overload reward — a garnish, not the main course. Gated by a
   *  plausibility band + cooldown so fabrication is unprofitable. */
  pr: 25,
  /** Granted once per achievement unlock. */
  achievement: 50,
} as const;

// Weekly cadence XP — the headline consistency reward. Cumulative by distinct
// training days in a calendar week, CAPPED at ~5 prescribed days so a 6th/7th
// session pays nothing (anti-overtraining by construction). Index by min(days, 5).
export const CADENCE_XP = [0, 15, 25, 40, 60, 80] as const;
export const PERFECT_WEEK_DAYS = 5;
export const PERFECT_WEEK_XP = 50;

/** XP for a single set's completion. Only completed, in-prescription sets pay. */
export function setCompletionXp(completed: boolean, isPrescribed: boolean): number {
  return completed && isPrescribed ? XP.prescribedSet : 0;
}

/** Flat log-quality bonus for a completed set; never scales with weight or reps. */
export function logQualityXp(args: {
  completed: boolean;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
}): number {
  if (!args.completed) return 0;
  let xp = 0;
  if (args.weight != null && args.reps != null) xp += XP.fullLog;
  if (args.rpe != null && args.rpe >= 5 && args.rpe <= 10) xp += XP.rpeLog;
  return xp;
}

// PR plausibility: a genuine e1RM gain over a prior best sits comfortably inside
// this band; a fabricated jump does not. Outside the band the PR is RECORDED (as the
// new best) but earns no XP and is flagged — killing the incentive to lie.
export const PR_MAX_GAIN_PCT = 15;
/** Don't pay a PR bonus for the same exercise more than once per this many days. */
export const PR_COOLDOWN_DAYS = 7;

/**
 * Cooldown gate for the PR bonus: given the dates (YYYY-MM-DD) on which a PR bonus
 * was ALREADY paid for this exercise, is `eventDate` far enough past all of them to
 * earn another? True iff no prior paid date sits within PR_COOLDOWN_DAYS before it.
 * Pure + date-keyed (not wall-clock) so the engine's award stays deterministic.
 */
export function prCooldownOk(priorPaidDates: string[], eventDate: string): boolean {
  const end = Date.parse(`${eventDate}T00:00:00Z`);
  if (Number.isNaN(end)) return true;
  const windowMs = PR_COOLDOWN_DAYS * 86_400_000;
  for (const d of priorPaidDates) {
    const t = Date.parse(`${d}T00:00:00Z`);
    if (Number.isNaN(t)) continue;
    // A strictly-earlier paid PR inside the window blocks this one.
    if (t < end && end - t < windowMs) return false;
  }
  return true;
}

export type PrCheck =
  | { kind: "none" }
  | { kind: "first"; e1rm: number } // first-ever gradeable set: new best, no bonus
  | { kind: "pr"; e1rm: number; gainPct: number; reward: boolean };

/**
 * Classify a completed set's e1RM against the user's prior best for that exercise.
 * `priorBest`/`priorAt` come from the per-exercise best map; `today` and `cooldownOk`
 * are supplied by the caller (which owns the dates).
 */
export function classifyPr(args: {
  e1rm: number;
  priorBest: number | null;
  cooldownOk: boolean;
}): PrCheck {
  const { e1rm, priorBest, cooldownOk } = args;
  if (!(e1rm > 0)) return { kind: "none" };
  if (priorBest == null || priorBest <= 0) return { kind: "first", e1rm };
  if (e1rm <= priorBest) return { kind: "none" };
  const gainPct = ((e1rm - priorBest) / priorBest) * 100;
  // Implausible jump → new best is still recorded, but no reward (reward=false).
  const plausible = gainPct <= PR_MAX_GAIN_PCT;
  return { kind: "pr", e1rm, gainPct, reward: plausible && cooldownOk };
}
