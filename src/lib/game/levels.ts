// Level curve + titles. A decelerating curve: early levels come fast (onboarding
// dopamine), later ones stretch (durable long-term goal). Titles reflect TRAINING
// MATURITY, never strength/bodyweight — a consistent newcomer can out-rank a strong
// but flaky lifter, which keeps the status ladder health-aligned.

/** XP required to advance FROM level n to n+1. round(80 · n^1.6). */
export function xpForLevel(n: number): number {
  return Math.round(80 * Math.pow(n, 1.6));
}

/** The level for a given lifetime XP total (level 1 at 0 XP). */
export function levelForXp(totalXp: number): number {
  let level = 1;
  let need = xpForLevel(level);
  let acc = need;
  while (totalXp >= acc) {
    level += 1;
    need = xpForLevel(level);
    acc += need;
  }
  return level;
}

/** Cumulative XP needed to REACH a level (level 1 = 0). */
export function xpToReach(level: number): number {
  let acc = 0;
  for (let n = 1; n < level; n++) acc += xpForLevel(n);
  return acc;
}

const TITLES: [number, string][] = [
  [50, "Architect"],
  [35, "Veteran"],
  [20, "Seasoned"],
  [10, "Disciplined"],
  [5, "Consistent"],
  [1, "Novice"],
];

/** Maturity-based title for a level (never references load or bodyweight). */
export function titleForLevel(level: number): string {
  for (const [min, title] of TITLES) if (level >= min) return title;
  return "Novice";
}

/** Progress within the current level, for a progress bar. */
export function levelProgress(totalXp: number): {
  level: number;
  title: string;
  intoLevel: number;
  levelSpan: number;
  toNext: number;
} {
  const level = levelForXp(totalXp);
  const base = xpToReach(level);
  const span = xpForLevel(level);
  const intoLevel = totalXp - base;
  return {
    level,
    title: titleForLevel(level),
    intoLevel,
    levelSpan: span,
    toNext: Math.max(0, span - intoLevel),
  };
}
