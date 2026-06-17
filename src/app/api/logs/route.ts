import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getLogsForWeek, upsertSetLog } from "@/db/logs";
import { evaluateGameEvents } from "@/db/game";
import { PROGRAM_IDS } from "@/lib/data";
import { resolveLocalDate } from "@/lib/time";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const programEnum = z.enum(PROGRAM_IDS);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const program = programEnum.safeParse(url.searchParams.get("program"));
  const week = z.coerce.number().int().min(1).max(52).safeParse(url.searchParams.get("week"));
  if (!program.success || !week.success) {
    return NextResponse.json({ error: "Bad query" }, { status: 400 });
  }
  const logs = await getLogsForWeek(session.user.id, program.data, week.data);
  return NextResponse.json({ logs });
}

const postSchema = z.object({
  program: programEnum,
  week: z.number().int().min(1).max(52),
  daySlug: z.string().min(1).max(120),
  exerciseSlug: z.string().min(1).max(120),
  setIndex: z.number().int().min(1).max(20),
  weight: z.number().min(0).max(2000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  rpe: z.number().min(0).max(10).nullable().optional(),
  completed: z.boolean().optional(),
  // Client record-time, used (clamped) to freeze the session's calendar date so an
  // offline set that flushes after midnight isn't mis-dated. Optional/untrusted.
  loggedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid log payload" }, { status: 400 });
  }
  const { loggedAt, ...logInput } = parsed.data;
  const row = await upsertSetLog(session.user.id, logInput, {
    timezone: session.user.timezone,
    loggedAt,
  });

  // Gamification engine (best-effort): a game-layer failure must never fail the
  // set save. Driven off the persisted row (normalized values), with the same
  // local event date the session writer used.
  let game = null;
  try {
    game = await evaluateGameEvents(
      session.user.id,
      {
        program: row.program,
        week: row.week,
        daySlug: row.daySlug,
        exerciseSlug: row.exerciseSlug,
        setIndex: row.setIndex,
        weight: row.weight,
        reps: row.reps,
        rpe: row.rpe,
        completed: row.completed,
      },
      { unit: session.user.unit, eventDate: resolveLocalDate(session.user.timezone, loggedAt) },
    );
  } catch (err) {
    console.error("[game] evaluate failed", err);
  }

  return NextResponse.json({ log: row, game }, { status: 200 });
}
