// Shared shape interfaces for the auto-generated program data (src/data/*.ts). The
// generated files are plain JSON objects with no types, so consumers used to
// reverse-engineer the shape via regex. These interfaces give one authoritative shape;
// data.ts casts the imports through them (the JSON is a structural superset, so a cast
// is sound — fields are never narrower than declared here). If the generator changes the
// shape, update these once.

export interface ProgramExercise {
  name: string;
  slug: string;
  demo: string;
  workingSets: string; // free-text count, e.g. "3" or "2-3"; parse with parseSets()
  reps: string | null;
  warmupSets: string | null;
  earlyRPE: string | null;
  lastRPE: string | null;
  rest: string | null;
  technique: string | null;
  sub1: string | null;
  sub2: string | null;
  notes: string | null;
}

export interface ProgramDay {
  title: string;
  slug: string;
  exercises: ProgramExercise[];
}

export interface ProgramWeek {
  number: number;
  block: string;
  subtitle: string | null;
  days: ProgramDay[];
}

export interface Program {
  id: string;
  name: string;
  intro: string;
  weeks: ProgramWeek[];
}

export interface GuideSection {
  slug: string;
  title: string;
  body: string;
}

export interface ExerciseLibraryItem {
  name: string;
  slug: string;
  demo: string;
  sub1: string | null;
  sub2: string | null;
  [k: string]: unknown; // library rows carry extra prescription fields; keep open
}
