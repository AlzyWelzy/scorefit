import { archetypeFor, type Archetype } from "@/lib/movement";

// Per-muscle weekly set-volume landmarks (sets/week), from common hypertrophy guidance
// (Israetel et al. — MEV minimum effective, MAV adaptive max, MRV recoverable max).
// Coarse, name-derived muscle groups mapped from our movement archetypes — enough for a
// "are you in the productive range" readout, not a prescription.
export type Muscle = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves" | "core";

export type VolumeLandmark = { mev: number; mav: number; mrv: number };

export const LANDMARKS: Record<Muscle, VolumeLandmark> = {
  chest: { mev: 8, mav: 16, mrv: 22 },
  back: { mev: 10, mav: 18, mrv: 25 },
  shoulders: { mev: 8, mav: 16, mrv: 22 },
  biceps: { mev: 6, mav: 14, mrv: 20 },
  triceps: { mev: 6, mav: 14, mrv: 18 },
  quads: { mev: 8, mav: 16, mrv: 20 },
  hamstrings: { mev: 6, mav: 12, mrv: 16 },
  glutes: { mev: 4, mav: 12, mrv: 16 },
  calves: { mev: 6, mav: 14, mrv: 20 },
  core: { mev: 0, mav: 12, mrv: 25 },
};

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
};

// Archetype → primary muscle. "raise" covers lateral/rear-delt + flyes, so it's split
// by name below; everything else maps cleanly. "static" (isolation, unknown) is dropped.
const ARCHETYPE_MUSCLE: Partial<Record<Archetype, Muscle>> = {
  press: "chest",
  pull: "back",
  curl: "biceps",
  triceps: "triceps",
  squat: "quads",
  hinge: "hamstrings",
  legcurl: "hamstrings",
  calf: "calves",
  core: "core",
};

/** Best-effort muscle for an exercise NAME (the heuristics are name-based). */
export function muscleFor(name: string): Muscle | null {
  const n = name.toLowerCase();
  // "raise" archetype is delts/chest-fly territory → shoulders (flyes lean chest, but
  // the bulk of raise-archetype movements are delt work; keep it simple → shoulders).
  if (/(lateral raise|rear delt|face pull|shrug|abduction)/.test(n)) return "shoulders";
  if (/(flye|fly|pec deck|crossover)/.test(n)) return "chest";
  if (/(glute|hip thrust|kickback)/.test(n)) return "glutes";
  if (/(overhead press|shoulder press|ohp|military)/.test(n)) return "shoulders";
  return ARCHETYPE_MUSCLE[archetypeFor(name)] ?? null;
}

export type MuscleVolumeRow = { muscle: Muscle; sets: number; landmark: VolumeLandmark; zone: VolumeZone };
export type VolumeZone = "below" | "productive" | "high" | "over";

export function zoneFor(sets: number, l: VolumeLandmark): VolumeZone {
  if (sets < l.mev) return "below";
  if (sets <= l.mav) return "productive";
  if (sets <= l.mrv) return "high";
  return "over";
}

/**
 * Aggregate completed sets per muscle for ONE week and classify against landmarks.
 * `entries` are completed sets with their exercise NAME. Returns only muscles with
 * a landmark (drops unclassifiable movements).
 */
export function weeklyMuscleVolume(entries: { name: string }[]): MuscleVolumeRow[] {
  const counts = new Map<Muscle, number>();
  for (const e of entries) {
    const m = muscleFor(e.name);
    if (!m) continue;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  const rows: MuscleVolumeRow[] = [];
  for (const [muscle, sets] of counts) {
    const landmark = LANDMARKS[muscle];
    rows.push({ muscle, sets, landmark, zone: zoneFor(sets, landmark) });
  }
  // Most-trained first.
  return rows.sort((a, b) => b.sets - a.sets);
}
