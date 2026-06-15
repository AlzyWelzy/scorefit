"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import type { ProgramId } from "@/lib/data";

export type LogExercise = {
  slug: string;
  name: string;
  sets: number;
  reps: string | null;
  lastRPE: string | null;
};
export type LogDay = { slug: string; title: string; exercises: LogExercise[] };
export type InitialLog = {
  daySlug: string;
  exerciseSlug: string;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
};

type Cell = { weight: string; reps: string; completed: boolean };
const keyOf = (d: string, e: string, i: number) => `${d}|${e}|${i}`;

export function Logger({
  program,
  programName,
  week,
  weeks,
  days,
  initialLogs,
}: {
  program: ProgramId;
  programName: string;
  week: number;
  weeks: number[];
  days: LogDay[];
  initialLogs: InitialLog[];
}) {
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const m: Record<string, Cell> = {};
    for (const l of initialLogs) {
      m[keyOf(l.daySlug, l.exerciseSlug, l.setIndex)] = {
        weight: l.weight?.toString() ?? "",
        reps: l.reps?.toString() ?? "",
        completed: l.completed,
      };
    }
    return m;
  });
  const [saving, setSaving] = useState<Record<string, "saving" | "saved">>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const cell = (k: string): Cell => cells[k] ?? { weight: "", reps: "", completed: false };

  const save = useCallback(
    async (daySlug: string, exerciseSlug: string, setIndex: number, c: Cell) => {
      const k = keyOf(daySlug, exerciseSlug, setIndex);
      setSaving((s) => ({ ...s, [k]: "saving" }));
      try {
        await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program,
            week,
            daySlug,
            exerciseSlug,
            setIndex,
            weight: c.weight === "" ? null : Number(c.weight),
            reps: c.reps === "" ? null : Number(c.reps),
            completed: c.completed,
          }),
        });
        setSaving((s) => ({ ...s, [k]: "saved" }));
        setTimeout(() => setSaving((s) => ({ ...s, [k]: undefined as never })), 1200);
      } catch {
        setSaving((s) => ({ ...s, [k]: undefined as never }));
      }
    },
    [program, week],
  );

  const update = (daySlug: string, ex: string, i: number, patch: Partial<Cell>, immediate = false) => {
    const k = keyOf(daySlug, ex, i);
    const next = { ...cell(k), ...patch };
    setCells((c) => ({ ...c, [k]: next }));
    clearTimeout(timers.current[k]);
    if (immediate) {
      void save(daySlug, ex, i, next);
    } else {
      timers.current[k] = setTimeout(() => void save(daySlug, ex, i, next), 700);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Logger · {programName}</span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Week <span className="num">{week}</span>
          </h1>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {(["beginner", "intermediate"] as ProgramId[]).map((p) => (
            <Link
              key={p}
              href={`/log?program=${p}&week=1`}
              className={`px-3 py-1.5 ${p === program ? "bg-accent text-bg" : "text-muted hover:text-fg"}`}
            >
              {p === "beginner" ? "Beginner" : "Int / Adv"}
            </Link>
          ))}
        </div>
      </div>

      {/* week switcher */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {weeks.map((n) => (
          <Link
            key={n}
            href={`/log?program=${program}&week=${n}`}
            className={`num rounded-lg border px-2.5 py-1 text-xs ${
              n === week ? "border-accent text-accent" : "border-line text-muted hover:text-fg"
            }`}
          >
            {n}
          </Link>
        ))}
      </div>

      <div className="mt-8 space-y-10">
        {days.map((d) => (
          <section key={d.slug}>
            <h2 className="mb-3 border-b border-line pb-2 font-display text-lg font-semibold">{d.title}</h2>
            <div className="space-y-5">
              {d.exercises.map((ex) => (
                <div key={ex.slug} className="rounded-card border border-line bg-surface p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-display font-semibold text-fg">{ex.name}</h3>
                    <span className="num shrink-0 text-xs text-faint">
                      {ex.sets}×{ex.reps ?? "—"}
                      {ex.lastRPE ? ` @ ${ex.lastRPE.replace("~", "")}` : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: ex.sets }, (_, idx) => {
                      const i = idx + 1;
                      const k = keyOf(d.slug, ex.slug, i);
                      const c = cell(k);
                      const st = saving[k];
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="num w-6 shrink-0 text-center text-xs text-faint">{i}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="weight"
                            value={c.weight}
                            onChange={(e) => update(d.slug, ex.slug, i, { weight: e.target.value })}
                            className="num w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                          />
                          <span className="text-faint">×</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="reps"
                            value={c.reps}
                            onChange={(e) => update(d.slug, ex.slug, i, { reps: e.target.value })}
                            className="num w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => update(d.slug, ex.slug, i, { completed: !c.completed }, true)}
                            aria-label={c.completed ? "Mark set incomplete" : "Mark set complete"}
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                              c.completed
                                ? "border-ok bg-ok/15 text-ok"
                                : "border-line text-faint hover:border-line-2 hover:text-muted"
                            }`}
                          >
                            {st === "saving" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-faint">
        Entries save automatically. <Link href="/progress" className="text-data hover:underline">View progress →</Link>
      </p>
    </div>
  );
}
