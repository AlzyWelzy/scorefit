"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

// Single kudos toggle on a feed event. Optimistic; reverts on failure.
export function KudosButton({ eventId, initialCount, initialMine }: { eventId: string; initialCount: number; initialMine: boolean }) {
  const [count, setCount] = useState(initialCount);
  const [mine, setMine] = useState(initialMine);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const nextMine = !mine;
    setMine(nextMine);
    setCount((c) => c + (nextMine ? 1 : -1));
    try {
      const res = await fetch("/api/social/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { kudosed: boolean };
      // Reconcile with the server's truth.
      setMine(data.kudosed);
    } catch {
      setMine(!nextMine);
      setCount((c) => c + (nextMine ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={mine}
      aria-label={mine ? "Remove kudos" : "Give kudos"}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-60 ${
        mine ? "border-accent text-accent" : "border-line text-muted hover:text-fg"
      }`}
    >
      <Heart className="h-3.5 w-3.5" fill={mine ? "currentColor" : "none"} />
      {count}
    </button>
  );
}
