// Weekly training volume — the ramping-volume model (Guidebook Figure 2).
// Explicit pixel heights (robust across nested flex) + CSS grow on load.
const WEEKS: { wk: number; sets: number; block: "F" | "R"; deload?: boolean }[] = [
  { wk: 1, sets: 62, block: "F", deload: true },
  { wk: 2, sets: 72, block: "F" },
  { wk: 3, sets: 72, block: "F" },
  { wk: 4, sets: 72, block: "F" },
  { wk: 5, sets: 72, block: "F" },
  { wk: 6, sets: 64, block: "R", deload: true },
  { wk: 7, sets: 85, block: "R" },
  { wk: 8, sets: 85, block: "R" },
  { wk: 9, sets: 97, block: "R" },
  { wk: 10, sets: 97, block: "R" },
  { wk: 11, sets: 108, block: "R" },
  { wk: 12, sets: 108, block: "R" },
];
const MAX = 120;

export function VolumeChart({ compact = false }: { compact?: boolean }) {
  const rowH = compact ? 120 : 180;
  const maxBar = rowH - 22;
  // Text alternative so the chart isn't conveyed by bar height/colour alone.
  const summary =
    "Weekly training volume in sets per week over 12 weeks: " +
    WEEKS.map(
      (w) => `week ${w.wk} ${w.sets}${w.deload ? " (deload)" : ""} ${w.block === "F" ? "foundation" : "ramping"}`,
    ).join(", ") +
    ".";
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">Weekly volume ramp</h3>
        <span className="eyebrow">sets / week</span>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: rowH }} role="img" aria-label={summary}>
        {WEEKS.map((w, i) => {
          const barPx = Math.round((w.sets / MAX) * maxBar);
          const color = w.block === "R" ? "var(--color-accent)" : "var(--color-faint)";
          return (
            <div key={w.wk} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="num text-[10px] text-faint">{w.sets}</span>
              <div
                className="sf-grow w-full rounded-t-sm"
                style={{
                  height: barPx,
                  animationDelay: `${i * 0.04}s`,
                  background: w.deload
                    ? `repeating-linear-gradient(45deg, ${color}, ${color} 3px, transparent 3px, transparent 6px)`
                    : `linear-gradient(to top, ${color}, color-mix(in srgb, ${color} 55%, transparent))`,
                  opacity: w.deload ? 0.75 : 1,
                }}
              />
              <span className="num text-[10px] text-faint">{w.wk}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted">
        <Legend swatch="bg-faint" label="Foundation — flat baseline" />
        <Legend swatch="bg-accent" label="Ramping — steps up every 2 wks" />
        <Legend hatch label="Deload" />
      </div>
    </div>
  );
}

function Legend({ swatch, hatch, label }: { swatch?: string; hatch?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`h-3 w-3 rounded-sm ${swatch ?? ""}`}
        style={hatch ? { background: "repeating-linear-gradient(45deg,var(--color-muted),var(--color-muted) 2px,transparent 2px,transparent 4px)" } : undefined}
      />
      {label}
    </span>
  );
}
