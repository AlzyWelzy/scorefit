// Competitive seasons: quarterly. Pure so it's testable and shared by the cron + reads.
// seasonId is the calendar quarter the date falls in, e.g. "2026-Q2".
export function currentSeasonId(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const q = Math.floor(((m || 1) - 1) / 3) + 1;
  return `${y}-Q${q}`;
}
