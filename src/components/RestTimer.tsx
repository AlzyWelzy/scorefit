"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const PRESETS = [60, 90, 120, 180];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function RestTimer() {
  const [total, setTotal] = useState(90);
  const [left, setLeft] = useState(90);
  const [running, setRunning] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      osc.onended = () => ctx.close();
    } catch {
      /* audio not available — silent */
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          setRunning(false);
          beep();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running, beep]);

  const set = (s: number) => {
    setRunning(false);
    setTotal(s);
    setLeft(s);
  };
  const reset = () => {
    setRunning(false);
    setLeft(total);
  };
  const toggle = () => {
    if (left === 0) {
      setLeft(total);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  };

  const pct = total > 0 ? left / total : 0;
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">Rest timer</h3>
        <span className="eyebrow">between sets</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line-2)" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={left === 0 ? "var(--color-ok)" : "var(--color-accent)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="num text-2xl font-semibold text-fg tabular-nums">{fmt(left)}</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex gap-2">
            <button
              onClick={toggle}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-2"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause" : left === 0 ? "Restart" : "Start"}
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-muted hover:text-fg"
              aria-label="Reset timer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => set(p)}
                className={`num rounded-lg border px-2.5 py-1 text-xs ${
                  total === p ? "border-accent text-accent" : "border-line text-muted hover:text-fg"
                }`}
              >
                {fmt(p)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
