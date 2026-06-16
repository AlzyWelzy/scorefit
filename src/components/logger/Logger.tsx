"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, CloudOff, RotateCw } from "lucide-react";
import type { ProgramId } from "@/lib/data";
import { saveSet, flushOutbox, pendingCount, type SaveState, type SetPayload } from "@/lib/logOutbox";

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
  rpe: number | null;
  completed: boolean;
};
export type PrevLoad = { weight: number | null; reps: number | null; week: number };

type Cell = { weight: string; reps: string; rpe: string; completed: boolean };
const cellKey = (d: string, e: string, i: number) => `${d}|${e}|${i}`;

export function Logger({
  program,
  programName,
  week,
  weeks,
  days,
  initialLogs,
  unit,
  prevLoads,
}: {
  program: ProgramId;
  programName: string;
  week: number;
  weeks: number[];
  days: LogDay[];
  initialLogs: InitialLog[];
  unit: "kg" | "lb";
  prevLoads: Record<string, PrevLoad>;
}) {
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const m: Record<string, Cell> = {};
    for (const l of initialLogs) {
      m[cellKey(l.daySlug, l.exerciseSlug, l.setIndex)] = {
        weight: l.weight?.toString() ?? "",
        reps: l.reps?.toString() ?? "",
        rpe: l.rpe?.toString() ?? "",
        completed: l.completed,
      };
    }
    return m;
  });
  // Outbox uses a global key (program|week|day|ex|set); the local UI key omits
  // program|week. Map outbox state back to the cell key for rendering.
  const [saving, setSaving] = useState<Record<string, SaveState>>({});
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [authExpired, setAuthExpired] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<Record<string, SetPayload>>({});

  const cell = (k: string): Cell =>
    cells[k] ?? { weight: "", reps: "", rpe: "", completed: false };

  const onState = useCallback((globalKey: string, state: SaveState) => {
    // globalKey = program|week|day|ex|set → strip the first two segments.
    const parts = globalKey.split("|");
    const localKey = parts.slice(2).join("|");
    setSaving((s) => {
      if (state === "saved") {
        // Clear the badge shortly after a successful save.
        setTimeout(() => setSaving((cur) => ({ ...cur, [localKey]: undefined as never })), 1200);
      }
      return { ...s, [localKey]: state };
    });
    setPending(pendingCount());
  }, []);

  const payloadOf = useCallback(
    (daySlug: string, ex: string, i: number, c: Cell): SetPayload => ({
      program,
      week,
      daySlug,
      exerciseSlug: ex,
      setIndex: i,
      weight: c.weight === "" ? null : Number(c.weight),
      reps: c.reps === "" ? null : Number(c.reps),
      rpe: c.rpe === "" ? null : Number(c.rpe),
      completed: c.completed,
    }),
    [program, week],
  );

  const flush = useCallback(
    (daySlug: string, ex: string, i: number, c: Cell) => {
      const p = payloadOf(daySlug, ex, i, c);
      latest.current[cellKey(daySlug, ex, i)] = p;
      void saveSet(p, onState);
    },
    [payloadOf, onState],
  );

  const update = (daySlug: string, ex: string, i: number, patch: Partial<Cell>, immediate = false) => {
    const k = cellKey(daySlug, ex, i);
    const next = { ...cell(k), ...patch };
    setCells((c) => ({ ...c, [k]: next }));
    clearTimeout(timers.current[k]);
    if (immediate) {
      flush(daySlug, ex, i, next);
    } else {
      timers.current[k] = setTimeout(() => flush(daySlug, ex, i, next), 700);
    }
  };

  // Online/offline + outbox flush + auth-expiry signalling.
  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(pendingCount());
    void flushOutbox(onState);

    const onOnline = () => {
      setOnline(true);
      void flushOutbox(onState).then(() => setPending(pendingCount()));
    };
    const onOffline = () => setOnline(false);
    const onAuth = () => setAuthExpired(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("scorefit-auth-expired", onAuth);

    // Flush any debounced-but-unsent edits before the page unloads.
    const onUnload = () => {
      for (const k of Object.keys(timers.current)) clearTimeout(timers.current[k]);
    };
    window.addEventListener("beforeunload", onUnload);

    // Periodic retry for queued items while the tab is open.
    const iv = setInterval(() => {
      if (navigator.onLine && pendingCount() > 0) {
        void flushOutbox(onState).then(() => setPending(pendingCount()));
      }
    }, 20_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("scorefit-auth-expired", onAuth);
      window.removeEventListener("beforeunload", onUnload);
      clearInterval(iv);
    };
  }, [onState]);

  const unitLabel = unit;

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

      {/* connection / sync status */}
      <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs">
        {authExpired ? (
          <span className="inline-flex items-center gap-1.5 text-hard">
            Session expired — <Link href="/login?callbackUrl=/log" className="underline">sign in again</Link> to sync.
          </span>
        ) : !online ? (
          <span className="inline-flex items-center gap-1.5 text-warn">
            <CloudOff className="h-3.5 w-3.5" /> Offline — sets are saved on this device and will sync when you reconnect.
          </span>
        ) : pending > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-warn">
            <RotateCw className="h-3.5 w-3.5 animate-spin" /> Syncing {pending} set{pending > 1 ? "s" : ""}…
          </span>
        ) : (
          <span className="text-faint">Entries save automatically · weights in {unitLabel}</span>
        )}
      </div>

      {/* first-run onboarding nudge */}
      {initialLogs.length === 0 && Object.keys(prevLoads).length === 0 && (
        <div className="mt-4 flex gap-3 rounded-card border border-line bg-surface p-4 text-sm text-muted">
          <span aria-hidden className="text-lg">👋</span>
          <p>
            Log a weight and reps for each set, then tap the check to mark it done. Your loads carry
            forward week to week so you always know what to beat.{" "}
            <Link href="/guidebook/understanding-the-program" className="text-data hover:underline">
              How the program works →
            </Link>
          </p>
        </div>
      )}

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
        {days.map((d, di) => (
          <section key={`${d.slug}-${di}`}>
            <h2 className="mb-3 border-b border-line pb-2 font-display text-lg font-semibold">{d.title}</h2>
            <div className="space-y-5">
              {d.exercises.map((ex) => (
                <div key={ex.slug} className="rounded-card border border-line bg-surface p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-display font-semibold text-fg">{ex.name}</h3>
                    <span className="num shrink-0 text-xs text-muted">
                      {ex.sets}×{ex.reps ?? "—"}
                      {ex.lastRPE ? ` @ ${ex.lastRPE.replace("~", "")}` : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: ex.sets }, (_, idx) => {
                      const i = idx + 1;
                      const k = cellKey(d.slug, ex.slug, i);
                      const c = cell(k);
                      const st = saving[k];
                      const prev = prevLoads[`${ex.slug}|${i}`];
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="num w-6 shrink-0 text-center text-xs text-muted">{i}</span>
                          <div className="flex w-0 flex-1 flex-col">
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder={prev?.weight != null ? `${prev.weight}` : `wt (${unitLabel})`}
                              value={c.weight}
                              onChange={(e) => update(d.slug, ex.slug, i, { weight: e.target.value })}
                              aria-label={`Set ${i} weight in ${unitLabel}`}
                              className="num w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-base text-fg focus:border-accent focus:outline-none"
                            />
                          </div>
                          <span className="text-faint">×</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder={prev?.reps != null ? `${prev.reps}` : "reps"}
                            value={c.reps}
                            onChange={(e) => update(d.slug, ex.slug, i, { reps: e.target.value })}
                            aria-label={`Set ${i} reps`}
                            className="num w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-2 text-base text-fg focus:border-accent focus:outline-none"
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            max="10"
                            placeholder="rpe"
                            value={c.rpe}
                            onChange={(e) => update(d.slug, ex.slug, i, { rpe: e.target.value })}
                            aria-label={`Set ${i} RPE`}
                            className="num w-14 shrink-0 rounded-lg border border-line bg-bg px-2 py-2 text-base text-fg focus:border-accent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => update(d.slug, ex.slug, i, { completed: !c.completed }, true)}
                            aria-label={c.completed ? "Mark set incomplete" : "Mark set complete"}
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                              st === "error"
                                ? "border-hard bg-hard/15 text-hard"
                                : c.completed
                                  ? "border-ok bg-ok/15 text-ok"
                                  : "border-line text-faint hover:border-line-2 hover:text-muted"
                            }`}
                          >
                            {st === "saving" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : st === "error" ? (
                              <RotateCw className="h-4 w-4" />
                            ) : st === "queued" ? (
                              <CloudOff className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(prevLoads).some((kk) => kk.startsWith(`${ex.slug}|`)) && (
                    <p className="mt-2 text-[11px] text-faint">
                      Greyed numbers show your last logged set — beat them.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-faint">
        <Link href="/progress" className="text-data hover:underline">View progress →</Link>
      </p>
    </div>
  );
}
