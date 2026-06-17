import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildWeekCoordinates, getProgramOrThrow, isProgramId, PROGRAM_META, type ProgramId } from "@/lib/data";
import { getLogsForProgram } from "@/db/logs";
import { getStreakSummary } from "@/db/streaks";
import { e1rm } from "@/lib/strength";
import { resolveLocalDate } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progress",
  alternates: { canonical: "/progress" },
  robots: { index: false, follow: false },
};

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/progress");

  const sp = await searchParams;
  const program: ProgramId = sp.program && isProgramId(sp.program) ? sp.program : "beginner";
  const prog = getProgramOrThrow(program);
  const unit = session.user.unit;
  const [logs, streak] = await Promise.all([
    getLogsForProgram(session.user.id, program),
    getStreakSummary(session.user.id, resolveLocalDate(session.user.timezone)),
  ]);

  // Valid prescription coordinates per week, so stale logs (after a program
  // edit) don't push "done" above "prescribed". Shares buildWeekCoordinates with
  // /log and the session roll-up so the slug/set math never diverges.
  const prescribed = new Map<number, number>();
  const validCoords = new Set<string>();
  const nameBySlug = new Map<string, string>();
  for (const w of prog.weeks) {
    const wc = buildWeekCoordinates(program, w.number);
    prescribed.set(w.number, wc.prescribedSets);
    for (const key of wc.coordKeys) validCoords.add(`${w.number}|${key}`);
    for (const d of wc.days) for (const ex of d.exercises) nameBySlug.set(ex.slug, ex.name);
  }

  const done = new Map<number, number>();
  const tonnage = new Map<number, number>();
  // Best e1RM per exercise across the program → PR list + trend.
  const bestByExercise = new Map<string, { e1rm: number; weight: number; reps: number; week: number }>();

  for (const l of logs) {
    if (!l.completed) continue;
    const inProgram = validCoords.has(`${l.week}|${l.daySlug}|${l.exerciseSlug}|${l.setIndex}`);
    if (inProgram) done.set(l.week, (done.get(l.week) ?? 0) + 1);
    if (l.weight != null && l.reps != null) {
      tonnage.set(l.week, (tonnage.get(l.week) ?? 0) + l.weight * l.reps);
      if (l.reps > 0 && l.weight > 0) {
        const est = e1rm(l.weight, l.reps);
        const cur = bestByExercise.get(l.exerciseSlug);
        if (!cur || est > cur.e1rm) {
          bestByExercise.set(l.exerciseSlug, { e1rm: est, weight: l.weight, reps: l.reps, week: l.week });
        }
      }
    }
  }

  const maxTonnage = Math.max(1, ...Array.from(tonnage.values()));
  const totalDone = Array.from(done.values()).reduce((a, b) => a + b, 0);
  const totalPrescribed = Array.from(prescribed.values()).reduce((a, b) => a + b, 0);
  const totalTonnage = Array.from(tonnage.values()).reduce((a, b) => a + b, 0);

  const prs = Array.from(bestByExercise.entries())
    .map(([slug, b]) => ({ name: nameBySlug.get(slug) ?? slug, ...b }))
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Progress · {PROGRAM_META[program].name}</span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Your training</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            <Link href="/profile" className="text-data hover:underline">Training Score →</Link>
            <Link href="/achievements" className="text-data hover:underline">Achievements →</Link>
            <a href="/api/logs/export" className="text-faint hover:text-muted hover:underline">Export CSV</a>
          </div>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {(["beginner", "intermediate"] as ProgramId[]).map((p) => (
            <Link
              key={p}
              href={`/progress?program=${p}`}
              className={`px-3 py-1.5 ${p === program ? "bg-accent text-bg" : "text-muted hover:text-fg"}`}
            >
              {PROGRAM_META[p].shortLabel}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="sets completed" value={`${totalDone}`} />
        <Stat label="of prescribed" value={`${totalPrescribed}`} />
        <Stat label={`total tonnage (${unit})`} value={totalTonnage.toLocaleString()} />
      </div>

      {/* Kept-week streak + consistency (cross-program; rest/deload weeks never break it) */}
      <div className="mt-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="week streak" value={`${streak.currentStreak}`} />
          <Stat label="longest" value={`${streak.longestStreak}`} />
          <Stat label="consistency" value={`${streak.rollingConsistency}%`} />
        </div>
        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="eyebrow">Don&apos;t break the chain</h2>
            <span className="text-[11px] text-faint">{streak.target}+ sessions/week = kept</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {streak.weeks.map((wk) => (
              <div
                key={wk.weekStart}
                title={`Week of ${wk.weekStart}: ${wk.days} day${wk.days === 1 ? "" : "s"}${wk.kept ? " · kept" : ""}`}
                aria-label={`Week of ${wk.weekStart}: ${wk.days} training days, ${wk.kept ? "kept" : "not kept"}`}
                className={[
                  "h-7 w-7 rounded-md border",
                  wk.isCurrent ? "ring-1 ring-accent" : "",
                  wk.kept
                    ? "border-ok/40 bg-ok/25"
                    : wk.days > 0
                      ? "border-data/30 bg-data/15"
                      : "border-line bg-surface-2",
                ].join(" ")}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            Each cell is a week. Rest days and deloads don&apos;t break your streak.
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="mt-10 rounded-card border border-line bg-surface px-5 py-10 text-center text-muted">
          No sets logged yet. <Link href="/log" className="text-accent hover:underline">Start logging →</Link>
        </p>
      ) : (
        <>
          <div className="mt-8">
            <h2 className="eyebrow mb-3">
              Tonnage by week <span className="text-faint">(completed weight × reps, {unit})</span>
            </h2>
            <div className="space-y-2.5">
              {prog.weeks.map((w) => {
                const n = w.number;
                const t = tonnage.get(n) ?? 0;
                const d = done.get(n) ?? 0;
                const p = prescribed.get(n) ?? 0;
                const pct = Math.round((t / maxTonnage) * 100);
                return (
                  <div key={n} className="flex items-center gap-3">
                    <span className="num w-12 shrink-0 text-xs text-faint">W{n}</span>
                    <div className="h-7 flex-1 overflow-hidden rounded-md bg-surface-2">
                      <div
                        className="flex h-full items-center justify-end rounded-md bg-data/25 px-2"
                        style={{ width: `${Math.max(pct, t > 0 ? 6 : 0)}%` }}
                      >
                        {t > 0 && <span className="num text-[11px] text-data">{t.toLocaleString()}</span>}
                      </div>
                    </div>
                    <span className="num w-14 shrink-0 text-right text-xs text-muted">
                      {Math.min(d, p)}/{p}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-right text-xs text-faint">sets done / prescribed →</p>
          </div>

          {prs.length > 0 && (
            <div className="mt-10">
              <h2 className="eyebrow mb-3">
                Estimated 1RM by exercise <span className="text-faint">(best set, Epley · {unit})</span>
              </h2>
              <div className="overflow-hidden rounded-card border border-line">
                {prs.map((pr) => (
                  <div
                    key={pr.name}
                    className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"
                  >
                    <span className="truncate text-sm text-fg">{pr.name}</span>
                    <span className="num shrink-0 text-xs text-muted">
                      {pr.weight}×{pr.reps} · W{pr.week} ·{" "}
                      <span className="text-data">e1RM {Math.round(pr.e1rm)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="num text-2xl font-bold text-fg">{value}</div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}
