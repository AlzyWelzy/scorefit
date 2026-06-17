import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildWeekCoordinates, getProgramOrThrow, isProgramId, PROGRAM_META, type ProgramId } from "@/lib/data";
import { getLogsForWeek, getPreviousLoads } from "@/db/logs";
import { Logger, type LogDay, type InitialLog, type PrevLoad } from "@/components/logger/Logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // reads session + db; never prerender

export const metadata: Metadata = { title: "Workout log", alternates: { canonical: "/log" } };

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/log");

  const sp = await searchParams;
  const program: ProgramId = sp.program && isProgramId(sp.program) ? sp.program : "beginner";
  const prog = getProgramOrThrow(program);
  const maxWeek = prog.weeks.length;
  const weekReq = parseInt(sp.week ?? "1", 10);
  const week = Number.isFinite(weekReq) ? Math.min(Math.max(weekReq, 1), maxWeek) : 1;

  // Shares the coordinate space (unique slugs + set counts) with /progress and the
  // session roll-up via buildWeekCoordinates.
  const days: LogDay[] = buildWeekCoordinates(program, week).days;

  const [rows, prevLoads] = await Promise.all([
    getLogsForWeek(session.user.id, program, week),
    getPreviousLoads(session.user.id, program, week),
  ]);
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
