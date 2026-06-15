"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Moon } from "lucide-react";
import type { DayHit } from "@/lib/today";
import { dayHref } from "@/lib/links";

type Maps = { beginner: Record<string, DayHit>; intermediate: Record<string, DayHit> };
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TodayCard({ maps }: { maps: Maps }) {
  // Compute weekday on the client so it reflects the user's timezone.
  const [weekday, setWeekday] = useState<string | null>(null);
  useEffect(() => {
    setWeekday(WEEKDAYS[new Date().getDay()]);
  }, []);

  if (!weekday) {
    // Pre-hydration placeholder keeps layout stable (no CLS).
    return <div className="rounded-card border border-line bg-surface p-5" style={{ minHeight: 132 }} aria-hidden />;
  }

  const b = maps.beginner[weekday];
  const i = maps.intermediate[weekday];
  const isRest = !b && !i;

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">today · {weekday}</span>
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
          ).map(([pid, hit]) =>
            hit ? (
              <Link
                key={pid}
                href={dayHref(pid, 1, hit.slug)}
                className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-bg px-4 py-3 transition-colors hover:border-accent"
              >
                <span>
                  <span className="block font-display font-semibold text-fg group-hover:text-accent">{hit.focus}</span>
                  <span className="eyebrow">{pid === "beginner" ? "Beginner" : "Int / Adv"} · Week 1</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
              </Link>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
