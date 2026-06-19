import { beginner } from "@/data/beginner";
import { intermediate } from "@/data/intermediate";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { guidebook } from "@/data/guidebook";

export type ProgramId = "beginner" | "intermediate";

/** Single source of truth for valid program ids. Drives static params,
 *  the sitemap, switchers, and the API z.enum — add a program here once. */
export const PROGRAM_IDS = ["beginner", "intermediate"] as const;

export function isProgramId(v: string): v is ProgramId {
  return (PROGRAM_IDS as readonly string[]).includes(v);
}

export const PROGRAMS = {
  beginner,
  intermediate,
} as const;

export const PROGRAM_META: Record<
  ProgramId,
  { id: ProgramId; name: string; shortLabel: string; tagline: string; level: string; href: string }
> = {
  beginner: {
    id: "beginner",
    name: "Beginner",
    shortLabel: "Beginner",
    tagline: "Learn the lifts, build the base, master tracking.",
    level: "0–1 yr training",
    href: "/programs/beginner",
  },
  intermediate: {
    id: "intermediate",
    name: "Intermediate / Advanced",
    shortLabel: "Int / Adv",
    tagline: "Higher intensity, every last set to failure.",
    level: "1+ yr training",
    href: "/programs/intermediate",
  },
};

export function getProgram(id: string) {
  return isProgramId(id) ? PROGRAMS[id] : null;
}

/** Like getProgram but narrows to ProgramId and throws on an unknown id,
 *  so call sites avoid the `getProgram(id)!` non-null assertion. */
export function getProgramOrThrow(id: ProgramId) {
  const p = getProgram(id);
  if (!p) throw new Error(`Unknown program: ${id}`);
  return p;
}

/** Number of weeks in a program — derive bounds from data, never hardcode 12. */
export function weekCount(id: ProgramId): number {
  return getProgramOrThrow(id).weeks.length;
}

/** Parse a prescribed "working sets" string into a positive count (capped). */
export function parseSets(v: string | null | undefined): number {
  const n = parseInt((v ?? "1").trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 1;
}

/**
 * Some weeks contain two training days that share a slug in the source data,
 * which collides as a React key and as a workout-log coordinate. Make slugs
 * unique within a list of days by suffixing repeats (`-2`, `-3`, …). The first
 * occurrence keeps its original slug so existing logs still match.
 */
export function uniqueDaySlug(slug: string, indexWithinWeek: number, priorSlugs: string[]): string {
  const seenBefore = priorSlugs.slice(0, indexWithinWeek).filter((s) => s === slug).length;
  return seenBefore === 0 ? slug : `${slug}-${seenBefore + 1}`;
}

export function getWeek(programId: string, weekNumber: number) {
  const p = getProgram(programId);
  if (!p) return null;
  return p.weeks.find((w) => w.number === weekNumber) ?? null;
}

export type WeekCoordinateExercise = {
  slug: string;
  name: string;
  sets: number;
  reps: string | null;
  lastRPE: string | null;
};
export type WeekCoordinateDay = { slug: string; title: string; exercises: WeekCoordinateExercise[] };
export type WeekCoordinates = {
  /** Days with collision-free slugs and per-exercise prescribed set counts. */
  days: WeekCoordinateDay[];
  /** Total prescribed working sets across the week. */
  prescribedSets: number;
  /** One key `${daySlug}|${exerciseSlug}|${setIndex}` per prescribed working set. */
  coordKeys: Set<string>;
};

/**
 * Canonical coordinate space for one program-week: normalizes day slugs (so
 * repeated slugs within a week don't collide), parses each exercise's set count,
 * and enumerates the valid `${daySlug}|${exerciseSlug}|${setIndex}` keys. The
 * single source the logger, the progress page, and the session roll-up all read,
 * so the slug/set math never drifts between them.
 */
export function buildWeekCoordinates(programId: ProgramId, weekNumber: number): WeekCoordinates {
  const w = getWeek(programId, weekNumber);
  if (!w) return { days: [], prescribedSets: 0, coordKeys: new Set() };

  const rawSlugs = w.days.map((d) => d.slug);
  const days: WeekCoordinateDay[] = [];
  const coordKeys = new Set<string>();
  let prescribedSets = 0;

  w.days.forEach((d, di) => {
    const slug = uniqueDaySlug(d.slug, di, rawSlugs);
    const exercises = d.exercises.map((ex) => {
      const sets = parseSets(ex.workingSets);
      prescribedSets += sets;
      for (let i = 1; i <= sets; i++) coordKeys.add(`${slug}|${ex.slug}|${i}`);
      return { slug: ex.slug, name: ex.name, sets, reps: ex.reps ?? null, lastRPE: ex.lastRPE ?? null };
    });
    days.push({ slug, title: d.title, exercises });
  });

  return { days, prescribedSets, coordKeys };
}

// slug → entry lookup maps, built once at module load instead of a linear
// scan on every call (hot on /exercises, /log, the search index, etc.).
const exerciseBySlug = new Map<string, (typeof exerciseLibrary)[number]>(
  exerciseLibrary.map((e) => [e.slug, e]),
);
const guideBySlug = new Map<
  string,
  { section: (typeof guidebook.sections)[number]; index: number }
>(guidebook.sections.map((s, i) => [s.slug, { section: s, index: i }]));

export function getExercise(slug: string) {
  return exerciseBySlug.get(slug) ?? null;
}

export function getGuideSection(slug: string) {
  return guideBySlug.get(slug)?.section ?? null;
}

/** Section plus its index, so the guidebook page can build prev/next without a second scan. */
export function getGuideSectionWithIndex(slug: string) {
  return guideBySlug.get(slug) ?? null;
}

// Block label for a given week number (shared by both programs).
export function blockFor(weekNumber: number): string {
  return weekNumber <= 5 ? "Foundation" : "Ramping";
}

export function isDeload(weekNumber: number): boolean {
  return weekNumber === 1 || weekNumber === 6;
}

export { exerciseLibrary, guidebook };
