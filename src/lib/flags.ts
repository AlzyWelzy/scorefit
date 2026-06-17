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
