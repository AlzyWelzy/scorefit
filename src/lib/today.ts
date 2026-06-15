// Resolves a weekday name to the matching training day in a program.
// Day titles begin with the weekday (e.g. "Tuesday — Lower (Strength Focus)"),
// so we match on that rather than guessing slugs.
import { getProgram, type ProgramId } from "@/lib/data";

export type DayHit = { slug: string; title: string; focus: string };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Map of weekday name -> day info for a program's first week. Rest days omitted. */
export function weekdayDayMap(programId: ProgramId, week = 1): Record<string, DayHit> {
  const program = getProgram(programId);
  const map: Record<string, DayHit> = {};
  if (!program) return map;
  const w = program.weeks.find((x) => x.number === week);
  if (!w) return map;
  for (const d of w.days) {
    const wd = WEEKDAYS.find((name) => d.title.toLowerCase().startsWith(name.toLowerCase()));
    if (!wd) continue;
    // focus = the part after the em dash, sans parenthetical
    const focus = (d.title.split("—")[1] ?? "").replace(/\(.*?\)/g, "").trim() || d.title;
    map[wd] = { slug: d.slug, title: d.title, focus };
  }
  return map;
}

export { WEEKDAYS };
