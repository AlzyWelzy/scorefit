import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { workoutLogs } from "@/db/schema";

export const runtime = "nodejs";

const csvCell = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Self-service data export (CSV) — data portability / GDPR. Every logged set the
// signed-in user owns; scoped to their userId, never anyone else's.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const rows = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.userId, session.user.id))
    .orderBy(asc(workoutLogs.program), asc(workoutLogs.week), asc(workoutLogs.daySlug), asc(workoutLogs.setIndex));

  const header = ["program", "week", "day", "exercise", "set", "weight", "reps", "rpe", "completed", "updatedAt"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.program, r.week, r.daySlug, r.exerciseSlug, r.setIndex, r.weight ?? "", r.reps ?? "", r.rpe ?? "", r.completed, r.updatedAt?.toISOString() ?? ""]
        .map(csvCell)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scorefit-logs.csv"',
    },
  });
}
