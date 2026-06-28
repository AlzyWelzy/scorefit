import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildWeekCoordinates, getProgramOrThrow, isProgramId, PROGRAM_META, resolveExerciseSlug, type ProgramId } from "@/lib/data";
import { getLogsForWeek, getPreviousLoads } from "@/db/logs";
import { getSwaps } from "@/db/swaps";
import { getUserById } from "@/db/users";
import { Logger, type LogDay, type InitialLog, type PrevLoad } from "@/components/logger/Logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // reads session + db; never prerender

export const metadata: Metadata = {
  title: "Workout log",
  alternates: { canonical: "/log" },
  robots: { index: false, follow: false },
};

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/log");

  const sp = await searchParams;
  // Resume where the user is (last-logged program/week) when no explicit params; an
  // explicit ?program=/?week= always wins (e.g. the "Log this day" deep-links).
  const me = await getUserById(session.user.id);
  const program: ProgramId = sp.program && isProgramId(sp.program)
    ? sp.program
    : (me?.currentProgram ?? "beginner");
  const prog = getProgramOrThrow(program);
  const maxWeek = prog.weeks.length;
  const defaultWeek = sp.program ? 1 : (me?.currentWeek ?? 1); // only fall back to saved week when program wasn't explicit
  const weekReq = parseInt(sp.week ?? String(defaultWeek), 10);
  const week = Number.isFinite(weekReq) ? Math.min(Math.max(weekReq, 1), maxWeek) : 1;

  const [rows, prevLoads, swaps] = await Promise.all([
    getLogsForWeek(session.user.id, program, week),
    getPreviousLoads(session.user.id, program, week),
    getSwaps(session.user.id, program),
  ]);

  // Shares the coordinate space (unique slugs + set counts) with /progress and the
  // session roll-up via buildWeekCoordinates; enriched with the user's recorded
  // substitutions (resolved to real library exercises) for the logger's swap menu.
  const days: LogDay[] = buildWeekCoordinates(program, week).days.map((d) => ({
    slug: d.slug,
    title: d.title,
    exercises: d.exercises.map((ex) => ({
      slug: ex.slug,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      lastRPE: ex.lastRPE,
      rest: ex.rest,
      subs: [ex.sub1, ex.sub2]
        .filter((s): s is string => !!s)
        .map((name) => ({ name, slug: resolveExerciseSlug(name) }))
        .filter((o): o is { name: string; slug: string } => o.slug !== null && o.slug !== ex.slug),
      swappedTo: swaps[`${d.slug}|${ex.slug}`] ?? null,
    })),
  }));
  const initialLogs: InitialLog[] = rows.map((r) => ({
    daySlug: r.daySlug,
    exerciseSlug: r.exerciseSlug,
    setIndex: r.setIndex,
    weight: r.weight,
    reps: r.reps,
    rpe: r.rpe,
    completed: r.completed,
  }));

  return (
    <Logger
      program={program}
      programName={PROGRAM_META[program].name}
      week={week}
      weeks={prog.weeks.map((x) => x.number)}
      days={days}
      initialLogs={initialLogs}
      unit={session.user.unit}
      prevLoads={prevLoads as Record<string, PrevLoad>}
    />
  );
}
