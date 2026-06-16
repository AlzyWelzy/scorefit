// Maps each exercise to a movement pattern, used for grouping the library and
// Archetypes drive the looped SVG animation so all 53 exercises get a
// tagging each exercise page.

export type Archetype =
  | "press"
  | "pull"
  | "curl"
  | "triceps"
  | "raise"
  | "squat"
  | "hinge"
  | "legcurl"
  | "core"
  | "calf"
  | "static";

const RULES: [RegExp, Archetype][] = [
  [/calf/i, "calf"],
  [/(crunch|leg raise|ab wheel|roman chair)/i, "core"],
  [/(leg curl)/i, "legcurl"],
  [/(rdl|hyperextension|deadlift|hip hinge)/i, "hinge"],
  [/(squat|leg press|lunge|leg extension|hack)/i, "squat"],
  [/(lateral raise|rear delt|flye|crossover|pec deck|shrug|abduction|adduction)/i, "raise"],
  [/(triceps|press-?down|push-?down|pressdown|kickback|skull|extension)/i, "triceps"],
  [/(curl)/i, "curl"],
  [/(pull-?up|pulldown|row|pull)/i, "pull"],
  [/(press|bench|push)/i, "press"],
];

export function archetypeFor(name: string): Archetype {
  for (const [re, a] of RULES) if (re.test(name)) return a;
  return "static";
}

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  press: "Pressing pattern",
  pull: "Pulling pattern",
  curl: "Elbow flexion",
  triceps: "Elbow extension",
  raise: "Abduction / raise",
  squat: "Knee-dominant",
  hinge: "Hip hinge",
  legcurl: "Knee flexion",
  core: "Trunk flexion",
  calf: "Plantar flexion",
  static: "Isolation",
};

// ---- Equipment inference (name-based heuristic) -------------------------
export type Equipment = "Barbell" | "Dumbbell" | "Cable" | "Machine" | "Bodyweight" | "Smith";

export function equipmentFor(name: string): Equipment {
  const n = name.toLowerCase();
  if (n.includes("smith")) return "Smith";
  if (/\bpull-?up\b|\bchin-?up\b|\bdip\b|hyperextension|push-?up/.test(n)) return "Bodyweight";
  if (/machine|pec deck|leg press|hack|pendulum|hip abduction|hip thrust machine/.test(n)) return "Machine";
  if (/cable|rope|pulldown|pull-down|crossover|pushdown|push-down|pressdown|press-down|face pull/.test(n)) return "Cable";
  if (/barbell|\bbb\b|ez-?bar|pendlay|deadlift|romanian/.test(n)) return "Barbell";
  if (/dumbbell|\bdb\b/.test(n)) return "Dumbbell";
  return "Machine";
}

export const EQUIPMENT_ALL: Equipment[] = ["Barbell", "Dumbbell", "Cable", "Machine", "Smith", "Bodyweight"];
