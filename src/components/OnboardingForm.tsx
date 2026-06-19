"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type ProgramId = "beginner" | "intermediate";
type Unit = "kg" | "lb";

const PROGRAMS: { id: ProgramId; name: string; blurb: string }[] = [
  { id: "beginner", name: "Beginner", blurb: "Build the base — 12 weeks, 5 days." },
  { id: "intermediate", name: "Intermediate / Advanced", blurb: "More volume & intensity — 12 weeks, 5 days." },
];

// First-run setup: pick program + start week + unit so the logger resumes here.
export function OnboardingForm({ initialUnit }: { initialUnit: Unit }) {
  const router = useRouter();
  const { update } = useSession();
  const [program, setProgram] = useState<ProgramId>("beginner");
  const [week, setWeek] = useState(1);
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, currentProgram: program, currentWeek: week }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Could not save. Try again.");
        return;
      }
      await update();
      router.push(`/log?program=${program}&week=${week}`);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      {error && (
        <p role="alert" className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard">
          {error}
        </p>
      )}

      <fieldset>
        <legend className="eyebrow mb-2">Choose your program</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROGRAMS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={program === p.id}
              onClick={() => setProgram(p.id)}
              className={`rounded-card border p-4 text-left transition-colors ${
                program === p.id ? "border-accent bg-accent-dim" : "border-line bg-surface hover:border-line-2"
              }`}
            >
              <div className="font-display font-semibold text-fg">{p.name}</div>
              <div className="mt-1 text-xs text-muted">{p.blurb}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="ob-week" className="eyebrow mb-2 block">Start week</label>
        <select
          id="ob-week"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          className="num rounded-lg border border-line bg-bg px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>Week {n}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">New to the program? Start at week 1.</p>
      </div>

      <div>
        <span className="eyebrow mb-2 block">Weight unit</span>
        <div role="group" aria-label="Weight unit" className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
          {(["kg", "lb"] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => setUnit(u)}
              className={`px-4 py-1.5 transition-colors ${unit === u ? "bg-accent text-bg" : "text-muted hover:text-fg"}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-bg transition-colors hover:bg-accent-2 disabled:opacity-60"
      >
        {busy ? "Setting up…" : "Start training →"}
      </button>
    </form>
  );
}
