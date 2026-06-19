"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const PRESETS = [60, 90, 120, 180];
const STORE_KEY = "scorefit.resttimer.v1";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

type Persisted = { total: number; endAt: number | null; pausedLeft: number | null };

export function RestTimer() {
  const [total, setTotal] = useState(90);
  // endAt is an absolute epoch ms when running; null when paused/idle.
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [left, setLeft] = useState(90);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const beeped = useRef(false);

  const running = endAt !== null;

  const beep = useCallback(() => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  const persist = useCallback((p: Persisted) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  // Recompute `left` from the absolute deadline. Survives tab-throttling,
  // backgrounding and phone-lock because it reads the wall clock, not a counter.
  const recompute = useCallback(() => {
    if (endAt === null) return;
    const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    setLeft(remaining);
    if (remaining === 0) {
      if (!beeped.current) {
        beeped.current = true;
        beep();
      }
      setEndAt(null);
      setPausedLeft(null);
      persist({ total, endAt: null, pausedLeft: null });
    }
  }, [endAt, beep, persist, total]);

  // Restore persisted state on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Persisted;
      // Restoring from localStorage must happen post-mount: the persisted state
      // differs from the SSR default, so doing it in render would hydration-mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTotal(p.total);
      if (p.endAt && p.endAt > Date.now()) {
        setEndAt(p.endAt);
        beeped.current = false;
      } else if (p.pausedLeft != null) {
        setPausedLeft(p.pausedLeft);
        setLeft(p.pausedLeft);
      } else {
        setLeft(p.total);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Tick + visibility/focus re-sync while running.
  useEffect(() => {
    if (endAt === null) return;
    // Kick the ticking subscription immediately, then on an interval.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recompute();
    const iv = setInterval(recompute, 250);
    const onVis = () => recompute();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [endAt, recompute]);

  // Screen Wake Lock while running so the phone doesn't sleep mid-rest.
  useEffect(() => {
    let released = false;
    const request = async () => {
      try {
        if (running && "wakeLock" in navigator) {
          wakeLock.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* not supported / denied */
      }
    };
    void request();
    return () => {
      released = true;
      void wakeLock.current?.release().catch(() => {});
      if (released) wakeLock.current = null;
    };
  }, [running]);

  const set = (s: number) => {
    setTotal(s);
    setEndAt(null);
    setPausedLeft(null);
    setLeft(s);
    persist({ total: s, endAt: null, pausedLeft: null });
  };

  // Auto-start: the logger fires `scorefit-rest-start` when a set is marked complete,
  // so the timer kicks off at the current preset without the user touching it.
  const startFresh = useCallback(() => {
    const newEnd = Date.now() + total * 1000;
    beeped.current = false;
    setEndAt(newEnd);
    setPausedLeft(null);
    setLeft(total);
    persist({ total, endAt: newEnd, pausedLeft: null });
  }, [total, persist]);
  useEffect(() => {
    const onStart = () => startFresh();
    window.addEventListener("scorefit-rest-start", onStart);
    return () => window.removeEventListener("scorefit-rest-start", onStart);
  }, [startFresh]);
  const reset = () => {
    setEndAt(null);
    setPausedLeft(null);
    setLeft(total);
    persist({ total, endAt: null, pausedLeft: null });
  };
  const toggle = () => {
    if (running) {
      // pause
      const remaining = Math.max(0, Math.round((endAt! - Date.now()) / 1000));
      setEndAt(null);
      setPausedLeft(remaining);
      setLeft(remaining);
      persist({ total, endAt: null, pausedLeft: remaining });
    } else {
      const start = pausedLeft != null && pausedLeft > 0 ? pausedLeft : total;
      const newEnd = Date.now() + start * 1000;
      beeped.current = false;
      setEndAt(newEnd);
      setPausedLeft(null);
      setLeft(start);
      persist({ total, endAt: newEnd, pausedLeft: null });
    }
  };

  // Clamp: left and total are independent state, so a mount-restore frame can
  // briefly have left > total (e.g. restoring a sub-90s preset) — don't overdraw.
  const pct = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const done = left === 0 && !running;

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">Rest timer</h3>
        <span className="eyebrow">between sets</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line-2)" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={done ? "var(--color-ok)" : "var(--color-accent)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center"
            role="timer"
            aria-label={done ? "Rest complete" : `${fmt(left)} remaining`}
          >
            <span className="num text-2xl font-semibold text-fg tabular-nums">
              {done ? "done" : fmt(left)}
            </span>
          </div>
          {/* Announce only completion (once), not every per-second tick. */}
          <span className="sr-only" aria-live="assertive">
            {done ? "Rest complete" : ""}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex gap-2">
            <button
              onClick={toggle}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-2"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause" : done ? "Restart" : pausedLeft != null ? "Resume" : "Start"}
            </button>
            <button
              onClick={reset}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line px-3 py-2 text-muted hover:text-fg"
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
                className={`num min-h-9 rounded-lg border px-2.5 py-1 text-xs ${
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
