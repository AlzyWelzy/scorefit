// Declarative achievement registry. Rules are PURE functions of a cheap aggregate
// context (computed once per evaluation in the engine), so adding a badge is adding
// one object here — no migration. Every rule is health-aligned: we reward breadth,
// consistency (distinct days, never daily streaks), completion, and honest PRs —
// never daily frequency, max weight, or training-through-rest.

export type AchievementTier = "bronze" | "silver" | "gold";
export type AchievementCategory =
  | "milestone"
  | "collection"
  | "volume"
  | "consistency"
  | "completion"
  | "pr"
  | "hidden";

export type AchievementContext = {
  distinctExercises: number;
  totalCompletedSets: number;
  lifetimeTonnage: number;
  distinctTrainingDays: number;
  programCompletion: { beginner: number; intermediate: number }; // 0..1
  hasAnyPr: boolean;
  daysSinceLastSession: number | null;
  unit: "kg" | "lb";
};

export type AchievementResult = {
  unlocked: boolean;
  tier: AchievementTier | null;
  progressValue: number;
  progressMax: number | null;
  evidence?: Record<string, unknown>;
};

export type AchievementRule = {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  hidden?: boolean;
  /** Key into achievement_progress for the running counter / progress bar. */
  progressKey: string;
  evaluate: (ctx: AchievementContext) => AchievementResult;
};

type Tier = { tier: AchievementTier; threshold: number };

/** Resolve a value against ascending tier thresholds. */
function tiered(value: number, tiers: Tier[]): { unlocked: boolean; tier: AchievementTier | null; next: number | null } {
  let reached: AchievementTier | null = null;
  let next: number | null = tiers[0]?.threshold ?? null;
  for (const t of tiers) {
    if (value >= t.threshold) {
      reached = t.tier;
      next = null;
    } else {
      next = t.threshold;
      break;
    }
  }
  return { unlocked: reached !== null, tier: reached, next };
}

export const ACHIEVEMENTS: AchievementRule[] = [
  {
    id: "first_lift",
    category: "milestone",
    title: "First Lift",
    description: "Log your first completed working set.",
    progressKey: "milestone:first_lift",
    evaluate: (c) => ({
      unlocked: c.totalCompletedSets >= 1,
      tier: null,
      progressValue: Math.min(c.totalCompletedSets, 1),
      progressMax: 1,
    }),
  },
  {
    id: "explorer",
    category: "collection",
    title: "Exercise Explorer",
    description: "Log distinct exercises from the 53-movement library.",
    progressKey: "collection:distinct_exercises",
    evaluate: (c) => {
      const t = tiered(c.distinctExercises, [
        { tier: "bronze", threshold: 10 },
        { tier: "silver", threshold: 25 },
        { tier: "gold", threshold: 53 },
      ]);
      return { unlocked: t.unlocked, tier: t.tier, progressValue: c.distinctExercises, progressMax: t.next };
    },
  },
  {
    id: "consistent",
    category: "consistency",
    title: "Consistent",
    description: "Train on distinct days. Rest days never count against you.",
    progressKey: "consistency:distinct_days",
    evaluate: (c) => {
      const t = tiered(c.distinctTrainingDays, [
        { tier: "bronze", threshold: 10 },
        { tier: "silver", threshold: 30 },
        { tier: "gold", threshold: 75 },
      ]);
      return { unlocked: t.unlocked, tier: t.tier, progressValue: c.distinctTrainingDays, progressMax: t.next };
    },
  },
  {
    id: "volume_landmark",
    category: "volume",
    title: "Tonnage Landmark",
    description: "Accumulate lifetime tonnage in kg (weight × reps, unit-normalized). Only ever goes up.",
    progressKey: "volume:lifetime",
    evaluate: (c) => {
      const t = tiered(c.lifetimeTonnage, [
        { tier: "bronze", threshold: 25_000 },
        { tier: "silver", threshold: 100_000 },
        { tier: "gold", threshold: 500_000 },
      ]);
      return {
        unlocked: t.unlocked,
        tier: t.tier,
        progressValue: Math.round(c.lifetimeTonnage),
        progressMax: t.next,
        evidence: { unit: c.unit },
      };
    },
  },
  {
    id: "block_finisher_beginner",
    category: "completion",
    title: "Block Finisher — Beginner",
    description: "Complete the 12-week Beginner program.",
    progressKey: "completion:beginner",
    evaluate: (c) => ({
      unlocked: c.programCompletion.beginner >= 0.9,
      tier: null,
      progressValue: Math.round(c.programCompletion.beginner * 100),
      progressMax: 100,
    }),
  },
  {
    id: "block_finisher_intermediate",
    category: "completion",
    title: "Block Finisher — Intermediate",
    description: "Complete the 12-week Intermediate / Advanced program.",
    progressKey: "completion:intermediate",
    evaluate: (c) => ({
      unlocked: c.programCompletion.intermediate >= 0.9,
      tier: null,
      progressValue: Math.round(c.programCompletion.intermediate * 100),
      progressMax: 100,
    }),
  },
  {
    id: "first_pr",
    category: "pr",
    title: "New Best",
    description: "Set your first estimated-1RM personal record.",
    progressKey: "pr:any",
    evaluate: (c) => ({
      unlocked: c.hasAnyPr,
      tier: null,
      progressValue: c.hasAnyPr ? 1 : 0,
      progressMax: 1,
    }),
  },
  {
    id: "came_back",
    category: "hidden",
    title: "Welcome Back",
    description: "Return to training after a 14+ day break. We reward coming back, never leaving.",
    hidden: true,
    progressKey: "hidden:came_back",
    evaluate: (c) => ({
      unlocked: c.daysSinceLastSession != null && c.daysSinceLastSession >= 14,
      tier: null,
      progressValue: c.daysSinceLastSession != null && c.daysSinceLastSession >= 14 ? 1 : 0,
      progressMax: 1,
    }),
  },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
