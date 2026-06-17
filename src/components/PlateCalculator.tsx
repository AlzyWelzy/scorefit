"use client";

import { useMemo, useState } from "react";

type Unit = "kg" | "lb";

const BAR: Record<Unit, [number, ...number[]]> = { kg: [20, 15, 10], lb: [45, 35, 25] };
const PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};
// One distinct token per plate size, cycled.
const SWATCH = [
  "var(--color-accent)",
  "var(--color-data)",
  "var(--color-ok)",
  "var(--color-warn)",
  "var(--color-accent-2)",
  "var(--color-muted)",
  "var(--color-faint)",
];

function solve(target: number, bar: number, plates: number[]) {
  let perSide = (target - bar) / 2;
  if (perSide < 0) return { ok: false as const, perSide: 0, used: [] as { w: number; n: number }[] };
  const used: { w: number; n: number }[] = [];
  for (const p of plates) {
    const n = Math.floor(perSide / p + 1e-9);
    if (n > 0) {
      used.push({ w: p, n });
      perSide -= n * p;
    }
  }
  return { ok: true as const, perSide: Math.round(perSide * 100) / 100, used };
}

export function PlateCalculator() {
  const [unit, setUnit] = useState<Unit>("kg");
  const [bar, setBar] = useState(BAR.kg[0]);
  const [target, setTarget] = useState<string>("");

  const num = parseFloat(target);
  const result = useMemo(() => {
    if (!isFinite(num)) return null;
    return solve(num, bar, PLATES[unit]);
  }, [num, bar, unit]);

  const switchUnit = (u: Unit) => {
    setUnit(u);
    setBar(BAR[u][0]);
  };

  return (
    <div className="glass p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">Plate calculator</h3>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {(["kg", "lb"] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => switchUnit(u)}
              className={`px-3 py-1.5 font-mono uppercase transition-colors ${unit === u ? "btn-accent rounded-none" : "text-muted hover:text-fg"}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="eyebrow mb-1 block">target weight</span>
          <input
            type="number"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 100"
            className="num w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-lg text-fg transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block">bar</span>
          <select
            value={bar}
            onChange={(e) => setBar(parseFloat(e.target.value))}
            className="num w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-lg text-fg transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {BAR[unit].map((b) => (
              <option key={b} value={b}>
                {b} {unit}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 min-h-[64px]">
        {result === null && <p className="text-sm text-faint">Enter a target weight to see the per-side loadout.</p>}
        {result && !result.ok && (
          <p className="text-sm text-hard">Target is below the bar weight ({bar} {unit}).</p>
        )}
        {result && result.ok && (
          <>
            <span className="eyebrow-accent">per side</span>
            {result.used.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Just the bar.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {result.used.map((p) => {
                  const idx = PLATES[unit].indexOf(p.w);
                  return (
                    <span
                      key={p.w}
                      className="num inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
                      style={{ borderColor: SWATCH[idx % SWATCH.length], color: SWATCH[idx % SWATCH.length] }}
                    >
                      <b className="font-semibold">{p.n}</b>
                      <span className="opacity-70">×</span>
                      {p.w}
                    </span>
                  );
                })}
              </div>
            )}
            {result.perSide > 0 && (
              <p className="num mt-2 text-xs text-warn">
                {result.perSide} {unit}/side unreachable with standard plates.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
