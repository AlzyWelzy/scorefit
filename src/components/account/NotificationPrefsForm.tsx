"use client";

import { useState } from "react";
import type { NotificationPrefs } from "@/db/notifications";

const CHANNELS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "reminders", label: "Training reminders", hint: "Nudges when you've lapsed or a streak is at risk." },
  { key: "digest", label: "Weekly digest", hint: "A Monday summary of your sessions, PRs and streak." },
  { key: "social", label: "Social", hint: "New followers, kudos and group invites." },
];

export function NotificationPrefsForm({ initial }: { initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState<keyof NotificationPrefs | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(key: keyof NotificationPrefs) {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setBusy(key);
    setErr(null);
    try {
      const res = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        setPrefs((p) => ({ ...p, [key]: !next })); // revert
        setErr("Couldn't save. Try again.");
      }
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next }));
      setErr("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {CHANNELS.map((c) => (
        <label key={c.key} className="card flex items-start justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-fg">{c.label}</span>
            <span className="block text-xs text-muted">{c.hint}</span>
          </span>
          <input
            type="checkbox"
            checked={prefs[c.key]}
            onChange={() => toggle(c.key)}
            disabled={busy === c.key}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
        </label>
      ))}
      {err && <p role="alert" className="text-hard text-sm">{err}</p>}
    </div>
  );
}
