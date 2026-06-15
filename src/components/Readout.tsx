import { ReactNode } from "react";

// Instrument readout: oversized mono value + micro label. The core data atom.
export function Stat({
  value,
  label,
  accent = "fg",
  size = "md",
}: {
  value: ReactNode;
  label: string;
  accent?: "fg" | "accent" | "data";
  size?: "sm" | "md" | "lg";
}) {
  const color =
    accent === "accent" ? "text-accent" : accent === "data" ? "text-data" : "text-fg";
  const fs = size === "lg" ? "text-3xl" : size === "sm" ? "text-xl" : "text-2xl";
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3.5">
      <div className={`num font-semibold leading-none ${fs} ${color}`}>{value}</div>
      <div className="eyebrow mt-2">{label}</div>
    </div>
  );
}

export function RpeBadge({ rpe }: { rpe?: string | null }) {
  if (!rpe || rpe === "N/A") return <span className="text-faint">—</span>;
  const clean = rpe.replace("~", "").trim();
  const top = parseFloat(clean.split(/[–\-]/).pop() || "0");
  const tone =
    top >= 9.5 ? "text-hard border-hard/30 bg-hard/10"
    : top >= 8 ? "text-warn border-warn/30 bg-warn/10"
    : "text-data border-data/30 bg-data/10";
  return (
    <span className={`num inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${tone}`}>
      RPE {clean}
    </span>
  );
}

// Bullet-style RPE meter (0–10), zone-colored. More informative than a gauge.
export function RpeBar({ rpe }: { rpe?: string | null }) {
  if (!rpe || rpe === "N/A") return null;
  const clean = rpe.replace("~", "").trim();
  const top = parseFloat(clean.split(/[–\-]/).pop() || "0");
  if (!top) return null;
  const pct = Math.min(100, (top / 10) * 100);
  const color = top >= 9.5 ? "var(--color-hard)" : top >= 8 ? "var(--color-warn)" : "var(--color-data)";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="num text-xs text-muted">{clean}</span>
    </div>
  );
}
