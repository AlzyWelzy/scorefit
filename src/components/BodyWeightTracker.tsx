"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type BodyPoint = { measuredOn: string; weight: number };

// Private bodyweight log + sparkline trend. Deliberately minimal (one number/day) and
// never surfaced publicly. The trend is a simple inline SVG so it needs no chart lib.
export function BodyWeightTracker({ unit, history }: { unit: "kg" | "lb"; history: BodyPoint[] }) {
  const router = useRouter();
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0 || w > 1000) {
      setError("Enter a valid weight.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/body-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: w }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Could not save.");
        return;
      }
      setWeight("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Oldest→newest for the trend line.
  const points = [...history].reverse();
  const latest = history[0];

  return (
    <section className="mt-10 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">Bodyweight</h2>
        {latest && (
          <span className="num text-sm text-muted">
            latest <span className="text-fg">{latest.weight}</span> {unit}
          </span>
        )}
      </div>

      {points.length >= 2 && <Sparkline points={points} unit={unit} />}

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder={`today's weight (${unit})`}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          aria-label={`Today's bodyweight in ${unit}`}
          className="num w-44 rounded-lg border border-line bg-bg px-3 py-2 text-base text-fg focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-2 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Log weight"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-hard">{error}</p>}
      <p className="mt-2 text-[11px] text-faint">
        Private to you — never shown on leaderboards or to anyone else. One entry per day.
      </p>
    </section>
  );
}

function Sparkline({ points, unit }: { points: BodyPoint[]; unit: "kg" | "lb" }) {
  const w = 320;
  const h = 56;
  const pad = 4;
  const vals = points.map((p) => p.weight);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (p.weight - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-14 w-full"
      role="img"
      aria-label={`Bodyweight trend: ${points.length} entries from ${points[0]!.weight} to ${points[points.length - 1]!.weight} ${unit}`}
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="var(--color-data)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
