import { weekStartOf, addDays } from "@/lib/time";

// The streak is WEEK-based, never a daily chain — a daily chain would punish the
// program's prescribed rest days and deloads (an injury hazard). A week is "kept"
// when you train a lenient number of distinct days, so rest days and light/deload
// weeks never break it. Target is deliberately low (habit floor); cadence XP
// separately rewards hitting more of your prescribed days.
export const STREAK_TARGET = 3;

// How many weeks the chain calendar shows, and how far back streak math looks.
const CHAIN_WEEKS = 12;
const MAX_LOOKBACK_WEEKS = 104;

export type WeekCell = {
  weekStart: string; // Monday, YYYY-MM-DD
  days: number; // distinct qualifying training days that week
  kept: boolean;
  score: number; // 0-100 consistency for the week
  isCurrent: boolean;
};

export type StreakSummary = {
  currentStreak: number;
  longestStreak: number;
  rollingConsistency: number; // 0-100, mean score over the last 4 weeks
  target: number;
  weeks: WeekCell[]; // chronological, last CHAIN_WEEKS (for the chain calendar)
};

/**
 * Compute the kept-week streak + consistency from a user's qualifying session dates
 * (YYYY-MM-DD, in their local tz) and their local "today". Pure + deterministic.
 *
 * The current (in-progress) week never BREAKS the streak — if you haven't hit the
 * target yet this week, the streak holds on your prior kept weeks rather than
 * resetting mid-week.
 */
export function computeStreak(
  dates: string[],
  today: string,
  target = STREAK_TARGET,
  // Calendar week-starts (Monday, YYYY-MM-DD) that fall in a program deload week. Those
  // weeks get a LOWERED target (max(2, target-1)) so correctly taking a deload easy still
  // keeps the streak — never raised. Deload-awareness the doc requires for Phase 1.
  deloadWeekStarts: Set<string> = new Set(),
  // Week-starts a freeze was applied to (by the week-close cron). A frozen week counts
  // as kept regardless of days trained — bridges a single missed week so the streak holds.
  frozenWeekStarts: Set<string> = new Set(),
): StreakSummary {
  const currentWeek = weekStartOf(today);
  const targetFor = (weekStart: string) =>
    deloadWeekStarts.has(weekStart) ? Math.max(2, target - 1) : target;

  // distinct days per week
  const daysByWeek = new Map<string, Set<string>>();
  for (const d of dates) {
    const w = weekStartOf(d);
    (daysByWeek.get(w) ?? daysByWeek.set(w, new Set()).get(w)!).add(d);
  }

  // Build a continuous week sequence from the earliest data (capped) up to the
  // current week, filling empty weeks so gaps correctly break the streak.
  let earliest = currentWeek;
  for (const w of daysByWeek.keys()) if (w < earliest) earliest = w;
  const floor = addDays(currentWeek, -7 * (MAX_LOOKBACK_WEEKS - 1));
  if (earliest < floor) earliest = floor;

  const cells: WeekCell[] = [];
  for (let w = earliest; w <= currentWeek; w = addDays(w, 7)) {
    const days = daysByWeek.get(w)?.size ?? 0;
    const wkTarget = targetFor(w);
    const frozen = frozenWeekStarts.has(w);
    cells.push({
      weekStart: w,
      days,
      kept: frozen || days >= wkTarget,
      score: frozen ? 100 : Math.min(100, Math.round((days / wkTarget) * 100)),
      isCurrent: w === currentWeek,
    });
  }

  // current streak: walk back from the current week; the in-progress current week
  // doesn't break it.
  let currentStreak = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i]!.kept) currentStreak += 1;
    else if (i === cells.length - 1) continue; // current week still in progress
    else break;
  }

  // longest run of consecutive kept weeks
  let longestStreak = 0;
  let run = 0;
  for (const c of cells) {
    run = c.kept ? run + 1 : 0;
    if (run > longestStreak) longestStreak = run;
  }

  const recent = cells.slice(-4);
  const rollingConsistency = recent.length
    ? Math.round(recent.reduce((a, c) => a + c.score, 0) / recent.length)
    : 0;

  return {
    currentStreak,
    longestStreak,
    rollingConsistency,
    target,
    weeks: cells.slice(-CHAIN_WEEKS),
  };
}
