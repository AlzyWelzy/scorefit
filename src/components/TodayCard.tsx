"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Moon } from "lucide-react";
import { WEEKDAYS, type DayHit } from "@/lib/today";
import { dayHref } from "@/lib/links";

type ProgramId = "beginner" | "intermediate";
type WeekMap = Record<string, DayHit>;
type MapsByWeek = { beginner: Record<number, WeekMap>; intermediate: Record<number, WeekMap> };

const subscribe = () => () => {};

export function TodayCard({ mapsByWeek }: { mapsByWeek: MapsByWeek }) {
  // Compute weekday on the client so it reflects the user's timezone. SSR and
  // the first hydration render use the server snapshot (null → placeholder),
  // then React re-renders with the resolved weekday — no hydration mismatch.
  const weekday = useSyncExternalStore(
    subscribe,
    () => WEEKDAYS[new Date().getDay()] ?? null,
    () => null,
  );

  // "Where you are" — so today's session deep-links to the user's CURRENT week, not
  // week 1. Read from the DB-backed status endpoint (the same source the verify banner
  // uses). Until it resolves — and for logged-out visitors — we fall back to week 1.
  const [pos, setPos] = useState<{ program: ProgramId | null; week: number }>({ program: null, week: 1 });
  useEffect(() => {
    let alive = true;
    fetch("/api/account/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.authenticated) return;
        const program: ProgramId | null =
          d.currentProgram === "beginner" || d.currentProgram === "intermediate" ? d.currentProgram : null;
        const week = Number.isInteger(d.currentWeek) && d.currentWeek >= 1 ? d.currentWeek : 1;
        setPos({ program, week });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!weekday) {
    // Pre-hydration placeholder keeps layout stable (no CLS).
    return <div className="card p-5" style={{ minHeight: 132 }} aria-hidden />;
  }

  // Per-program week to surface: the user's current week for their current program; week
  // 1 otherwise. The slug comes from that week's map (deload weeks rename days).
  const weekFor = (pid: ProgramId) => (pos.program === pid ? pos.week : 1);
  const hitFor = (pid: ProgramId): DayHit | null => mapsByWeek[pid][weekFor(pid)]?.[weekday] ?? null;

  const b = hitFor("beginner");
  const i = hitFor("intermediate");
  const isRest = !b && !i;

  return (
    <div className="glass p-5">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow-accent">today · {weekday}</span>
        {isRest && <span className="eyebrow text-data">rest day</span>}
      </div>

      {isRest ? (
        <div className="mt-3 flex items-center gap-3 text-muted">
          <Moon className="h-5 w-5 text-data" />
          <p className="text-sm">No session scheduled. Recover, eat, sleep — then hit it tomorrow.</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["beginner", b],
              ["intermediate", i],
            ] as const
          ).map(([pid, hit]) => {
            if (!hit) return null;
            const week = weekFor(pid);
            return (
              <Link
                key={pid}
                href={dayHref(pid, week, hit.slug)}
                className="card card-hover group flex items-center justify-between gap-3 px-4 py-3"
              >
                <span>
                  <span className="block font-display font-semibold text-fg group-hover:text-accent">{hit.focus}</span>
                  <span className="eyebrow">{pid === "beginner" ? "Beginner" : "Int / Adv"} · Week {week}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
