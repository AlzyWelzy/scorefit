"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Users, UserPlus } from "lucide-react";

// Create a group or join one by id. Both POST to the groups API and navigate to the group.
export function GroupsManager({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"crew" | "coaching">("crew");
  const [joinId, setJoinId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Could not create the group.");
        return;
      }
      setName("");
      router.push(`/groups/${data.id}`);
    } finally {
      setBusy(false);
    }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const id = joinId.trim();
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Could not join that group.");
        return;
      }
      router.push(`/groups/${id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form onSubmit={create} className="glass p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Users className="h-4 w-4 text-accent" /> Create a group
        </h2>
        <p className="mt-1 text-sm text-muted">A crew to train alongside, or a coaching roster.</p>
        <label className="mt-3 block">
          <span className="eyebrow mb-1 block">name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            placeholder="e.g. Garage Gym Crew"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <div className="mt-3 inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {(["crew", "coaching"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 capitalize transition-colors ${kind === k ? "btn-accent rounded-none" : "text-muted hover:text-fg"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <button type="submit" disabled={busy || disabled} className="btn-accent mt-4 w-full py-2 text-sm disabled:opacity-50">
          Create group
        </button>
      </form>

      <form onSubmit={join} className="glass p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <UserPlus className="h-4 w-4 text-data" /> Join a group
        </h2>
        <p className="mt-1 text-sm text-muted">Paste the group ID someone shared with you.</p>
        <label className="mt-3 block">
          <span className="eyebrow mb-1 block">group id</span>
          <input
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="num w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <button type="submit" disabled={busy || disabled} className="btn-surface mt-4 w-full py-2 text-sm disabled:opacity-50">
          Join group
        </button>
      </form>

      {err && (
        <p role="alert" className="text-hard sm:col-span-2 text-sm">
          {err}
        </p>
      )}
    </div>
  );
}
