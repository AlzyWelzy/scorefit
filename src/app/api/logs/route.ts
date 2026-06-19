import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getLogsForWeek, upsertSetLog } from "@/db/logs";
import { evaluateGameEvents } from "@/db/game";
import { getUserById, setCurrentPosition } from "@/db/users";
import { emitActivityEvent } from "@/db/social";
import { ensureWeeklyChallenge } from "@/db/phase4";
import { PROGRAM_IDS } from "@/lib/data";
import { resolveLocalDate } from "@/lib/time";
import { sameOrigin } from "@/lib/rateLimit";
import { captureException } from "@/lib/observability";

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

  // Remember where the user is so /log, /progress and TodayCard resume here next time.
  // Best-effort: a failure must never fail the set save.
  try {
    await setCurrentPosition(session.user.id, row.program, row.week);
  } catch (err) {
    await captureException(err, { where: "logs.setCurrentPosition", extra: { userId: session.user.id } });
  }


  // Gamification engine (best-effort): a game-layer failure must never fail the
  // set save. Driven off the persisted row (normalized values), with the same
  // local event date the session writer used. Skipped entirely for users who have
  // turned gamification off (the hard anti-compulsion switch) — no XP/PR/achievement
  // mechanics fire, though the set + dated session are still saved by upsertSetLog.
  // Read live (not from the JWT) so toggling off takes effect on the next set.
  let game = null;
  const actor = await getUserById(session.user.id);
  if (actor && !actor.gamificationOptOut) {
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
      await captureException(err, { where: "game.evaluate", extra: { userId: session.user.id } });
    }

    // Emit social activity events from the outcome (best-effort, idempotent per day).
    // Always recorded so a follower feed has history the moment SOCIAL is enabled; the
    // events are only ever READ behind the flag. Opted-out users emit nothing (we're
    // inside the !gamificationOptOut branch).
    if (game) {
      const day = resolveLocalDate(session.user.timezone, loggedAt);
      try {
        if (game.newPr) {
          await emitActivityEvent(session.user.id, "e1rm_pr", day, {
            exerciseSlug: game.newPr.exerciseSlug,
            e1rm: Math.round(game.newPr.e1rm),
          });
        }
        for (const a of game.newlyUnlocked) {
          if (!a.hidden) await emitActivityEvent(session.user.id, "achievement", day, { id: a.id, title: a.title });
        }
      } catch (err) {
        await captureException(err, { where: "social.emit", extra: { userId: session.user.id } });
      }
    }

    // Implicitly enroll in this week's auto-recurring consistency challenge (Phase 4 MVP).
    // Best-effort; the week-close cron scores + resolves it.
    try {
      await ensureWeeklyChallenge(session.user.id, resolveLocalDate(session.user.timezone, loggedAt));
    } catch (err) {
      await captureException(err, { where: "logs.ensureWeeklyChallenge", extra: { userId: session.user.id } });
    }
  }

  return NextResponse.json({ log: row, game }, { status: 200 });
}
