// Builds a flat, serializable index for the ⌘K command palette.
// Small enough (~90 entries) to ship to the client and filter there.
import { PROGRAMS, PROGRAM_META, blockFor, type ProgramId } from "@/lib/data";
import { exerciseLibrary } from "@/lib/data";
import { guidebook } from "@/lib/data";
import { archetypeFor, ARCHETYPE_LABEL } from "@/lib/movement";
import { exerciseHref, weekHref, programHref, guideHref } from "@/lib/links";

export type SearchKind = "Exercise" | "Week" | "Program" | "Guide";

export type SearchEntry = {
  id: string;
  title: string;
  subtitle: string;
  kind: SearchKind;
  href: string;
  /** Lowercased haystack for matching. */
  terms: string;
};

export function buildSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];

  // Programs
  (Object.keys(PROGRAMS) as ProgramId[]).forEach((id) => {
    const meta = PROGRAM_META[id];
    out.push({
      id: `program:${id}`,
      title: meta.name,
      subtitle: "Program",
      kind: "Program",
      href: programHref(id),
      terms: `${meta.name} program ${id}`.toLowerCase(),
    });
  });

  // Weeks
  (Object.keys(PROGRAMS) as ProgramId[]).forEach((id) => {
    const program = PROGRAMS[id];
    program.weeks.forEach((w) => {
      const block = blockFor(w.number);
      out.push({
        id: `week:${id}:${w.number}`,
        title: `Week ${w.number}`,
        subtitle: `${PROGRAM_META[id].name} · ${block}`,
        kind: "Week",
        href: weekHref(id, w.number),
        terms: `week ${w.number} ${block} ${PROGRAM_META[id].name}`.toLowerCase(),
      });
    });
  });

  // Exercises (unique library)
  exerciseLibrary.forEach((ex) => {
    const label = ARCHETYPE_LABEL[archetypeFor(ex.name)];
    out.push({
      id: `exercise:${ex.slug}`,
      title: ex.name,
      subtitle: label,
      kind: "Exercise",
      href: exerciseHref(ex.slug),
      terms: `${ex.name} ${label} ${ex.sub1 ?? ""} ${ex.sub2 ?? ""}`.toLowerCase(),
    });
  });

  // Guidebook sections
  guidebook.sections.forEach((s) => {
    out.push({
      id: `guide:${s.slug}`,
      title: s.title,
      subtitle: "Guidebook",
      kind: "Guide",
      href: guideHref(s.slug),
      terms: `${s.title} guidebook guide`.toLowerCase(),
    });
  });

  return out;
}

export const searchIndex = buildSearchIndex();
