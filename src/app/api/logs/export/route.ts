import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { workoutLogs } from "@/db/schema";
import { getUserById } from "@/db/users";

export const runtime = "nodejs";

const csvCell = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// The account/consent profile we hold about the user. Included in every export so
// data portability (GDPR) covers the leaderboard/consent fields — birth year, the
// public display name, the opt-in flag and its consent timestamp — not just logs.
function accountExport(u: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
  return {
    email: u.email,
    name: u.name,
    unit: u.unit,
    timezone: u.timezone,
    displayName: u.displayName,
    birthYear: u.birthYear,
    leaderboardOptIn: u.leaderboardOptIn,
    acceptedTermsAt: u.acceptedTermsAt?.toISOString() ?? null,
    createdAt: u.createdAt?.toISOString() ?? null,
  };
}

// Self-service data export — data portability / GDPR. Everything we hold about the
// signed-in user: their account/consent profile plus every logged set they own.
// Scoped to their userId, never anyone else's. Default CSV (logs, with the account
// profile in a leading comment block); ?format=json returns the full structured doc.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const user = await getUserById(session.user.id);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.userId, session.user.id))
    .orderBy(asc(workoutLogs.program), asc(workoutLogs.week), asc(workoutLogs.daySlug), asc(workoutLogs.setIndex));

  const account = accountExport(user);

  const format = new URL(req.url).searchParams.get("format");
  if (format === "json") {
    const body = {
      account,
      logs: rows.map((r) => ({
        program: r.program,
        week: r.week,
        day: r.daySlug,
        exercise: r.exerciseSlug,
        set: r.setIndex,
        weight: r.weight,
        reps: r.reps,
        rpe: r.rpe,
        completed: r.completed,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      })),
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="scorefit-export.json"',
      },
    });
  }

  // CSV: the account/consent profile as a leading `# key,value` comment block, then
  // the logs table. Keeps the long-standing single-file CSV download self-contained.
  const lines: string[] = ["# ScoreFit data export — account profile"];
  for (const [k, v] of Object.entries(account)) {
    lines.push(`# ${csvCell(k)},${csvCell(v)}`);
  }
  lines.push("");

  const header = ["program", "week", "day", "exercise", "set", "weight", "reps", "rpe", "completed", "updatedAt"];
  lines.push(header.join(","));
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
      "Content-Disposition": 'attachment; filename="scorefit-export.csv"',
    },
  });
}
