// Shared strength math. Single source of truth so the progress page, the session
// roll-up, PR detection, and any future leaderboard all estimate 1RM identically.

/** Epley estimated one-rep max from a working set's load and reps. */
export function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}
