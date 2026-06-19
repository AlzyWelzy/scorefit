import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { workoutSessions } from "@/db/schema";
import { PROGRAM_META, isProgramId } from "@/lib/data";

export const runtime = "nodejs";

// iCalendar escaping: commas, semicolons, backslashes, and newlines are special.
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

// A calendar export of completed training sessions (.ics). The easy first step toward
// calendar/wearable integration — every qualifying session becomes an all-day event.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const rows = await db
    .select({
      sessionDate: workoutSessions.sessionDate,
      program: workoutSessions.program,
      week: workoutSessions.week,
      completedSets: workoutSessions.completedSets,
      tonnage: workoutSessions.tonnage,
      qualifies: workoutSessions.qualifies,
    })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, session.user.id))
    .orderBy(asc(workoutSessions.sessionDate));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ScoreFit//Training Log//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:ScoreFit training",
  ];

  for (const r of rows) {
    if (!r.qualifies) continue;
    const ymd = r.sessionDate.replace(/-/g, ""); // YYYYMMDD all-day
    const programName = isProgramId(r.program) ? PROGRAM_META[r.program].name : r.program;
    const title = `Trained — ${programName} W${r.week}`;
    const desc = `${r.completedSets} sets · ${Math.round(r.tonnage).toLocaleString()} tonnage`;
    // UID stable per user+day so re-imports update rather than duplicate.
    const uid = `${session.user.id}-${ymd}@scorefit.net`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${ymd}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(desc)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scorefit-sessions.ics"',
    },
  });
}
