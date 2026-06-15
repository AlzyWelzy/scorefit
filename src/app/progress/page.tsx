import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProgram, PROGRAM_META, type ProgramId } from "@/lib/data";
import { getLogsForProgram } from "@/db/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Progress" };

function parseSets(v: string | null | undefined): number {
  const n = parseInt((v ?? "1").trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 1;
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/progress");

  const sp = await searchParams;
  const program: ProgramId = sp.program === "intermediate" ? "intermediate" : "beginner";
  const prog = getProgram(program)!;
  const logs = await getLogsForProgram(session.user.id, program);

  const prescribed = new Map<number, number>();
  for (const w of prog.weeks) {
    let count = 0;
    for (const d of w.days) for (const ex of d.exercises) count += parseSets(ex.workingSets);
    prescribed.set(w.number, count);
  }

  const done = new Map<number, number>();
  const tonnage = new Map<number, number>();
  for (const l of logs) {
    if (l.completed) done.set(l.week, (done.get(l.week) ?? 0) + 1);
    if (l.weight != null && l.reps != null) {
      tonnage.set(l.week, (tonnage.get(l.week) ?? 0) + l.weight * l.reps);
    }
  }
  const maxTonnage = Math.max(1, ...Array.from(tonnage.values()));
  const totalDone = Array.from(done.values()).reduce((a, b) => a + b, 0);
  const totalPrescribed = Array.from(prescribed.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Progress · {PROGRAM_META[program].name}</span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Your training</h1>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {(["beginner", "intermediate"] as ProgramId[]).map((p) => (
            <Link
              key={p}
              href={`/progress?program=${p}`}
              className={`px-3 py-1.5 ${p === program ? "bg-accent text-bg" : "text-muted hover:text-fg"}`}
            >
              {p === "beginner" ? "Beginner" : "Int / Adv"}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="sets completed" value={`${totalDone}`} />
        <Stat label="of prescribed" value={`${totalPrescribed}`} />
        <Stat
          label="total tonnage"
          value={Array.from(tonnage.values()).reduce((a, b) => a + b, 0).toLocaleString()}
        />
      </div>

      {logs.length === 0 ? (
        <p className="mt-10 rounded-card border border-line bg-surface px-5 py-10 text-center text-muted">
          No sets logged yet. <Link href="/log" className="text-accent hover:underline">Start logging →</Link>
        </p>
      ) : (
        <div className="mt-8">
          <h2 className="eyebrow mb-3">Tonnage by week <span className="text-faint">(completed weight × reps)</span></h2>
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
                    {d}/{p}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-right text-xs text-faint">sets done / prescribed →</p>
        </div>
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
