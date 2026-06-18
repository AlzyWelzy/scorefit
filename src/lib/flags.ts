// Feature flags. Leaderboards and social default OFF — they publish health-adjacent
// personal data and MUST NOT go live until the consent / age-gate / privacy-policy
// layer and a legal review are complete (see LEADERBOARDS_SAFETY.md). Flip via env
// only when that checklist is satisfied.
export const FLAGS = {
  leaderboards: process.env.LEADERBOARDS_ENABLED === "true",
  social: process.env.SOCIAL_ENABLED === "true",
} as const;

/** Minimum age to participate in any public/social surface (COPPA floor). */
export const MIN_AGE = 13;

/** Age (in whole years, by birth-year only) as of `now` (defaults to current year). */
export function ageFromBirthYear(birthYear: number, now: number = new Date().getUTCFullYear()): number {
  return now - birthYear;
}

/**
 * Whether a birth year clears MIN_AGE. Used at registration (to gate feature access)
 * and at leaderboard opt-in. Birth-year-only is intentionally coarse (no full DOB):
 * it can over-restrict someone by up to a year, which is the safe direction for a
 * minor-protection floor. A missing/zero birth year is treated as NOT meeting it.
 */
export function meetsMinAge(birthYear: number | null | undefined): boolean {
  if (!birthYear) return false;
  return ageFromBirthYear(birthYear) >= MIN_AGE;
}
