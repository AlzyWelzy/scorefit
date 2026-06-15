import { beginner } from "@/data/beginner";
import { intermediate } from "@/data/intermediate";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { guidebook } from "@/data/guidebook";
import { appendix } from "@/data/appendix";

export type ProgramId = "beginner" | "intermediate";

export const PROGRAMS = {
  beginner,
  intermediate,
} as const;

export const PROGRAM_META: Record<
  ProgramId,
  { id: ProgramId; name: string; tagline: string; level: string; href: string }
> = {
  beginner: {
    id: "beginner",
    name: "Beginner",
    tagline: "Learn the lifts, build the base, master tracking.",
    level: "0–1 yr training",
    href: "/programs/beginner",
  },
  intermediate: {
    id: "intermediate",
    name: "Intermediate / Advanced",
    tagline: "Higher intensity, every last set to failure.",
    level: "1+ yr training",
    href: "/programs/intermediate",
  },
};

export function getProgram(id: string) {
  if (id === "beginner") return beginner;
  if (id === "intermediate") return intermediate;
  return null;
}

export function getWeek(programId: string, weekNumber: number) {
  const p = getProgram(programId);
  if (!p) return null;
  return p.weeks.find((w) => w.number === weekNumber) ?? null;
}

export function getExercise(slug: string) {
  return exerciseLibrary.find((e) => e.slug === slug) ?? null;
}

export function getGuideSection(slug: string) {
  return guidebook.sections.find((s) => s.slug === slug) ?? null;
}

// Strip the redundant leading headers from the raw program intro and return
// the warm-up / structure prose only.
export function cleanIntro(raw: string): string {
  return raw
    .replace(/^# PART \d+:[^\n]*\n+/i, "")
    .replace(/^# (Beginner|Intermediate)[^\n]*\n+/i, "")
    .trim();
}

// Block label for a given week number (shared by both programs).
export function blockFor(weekNumber: number): string {
  return weekNumber <= 5 ? "Foundation" : "Ramping";
}

export function isDeload(weekNumber: number): boolean {
  return weekNumber === 1 || weekNumber === 6;
}

export { exerciseLibrary, guidebook, appendix };
