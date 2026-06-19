"use client";

import { useState } from "react";

/** Consent + age gate to join the (opt-in) leaderboards. Posts to the account PATCH;
 *  the server enforces the age floor and stamps the consent timestamp. */
export function LeaderboardOptIn() {
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!agree) return setErr("Please accept the honor pledge and terms to continue.");
    const yr = Number(birthYear);
    if (!Number.isInteger(yr) || yr < 1900) return setErr("Enter a valid birth year.");
    setBusy(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderboardOptIn: true, displayName: displayName.trim() || null, birthYear: yr }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.reload();
      return;
    }
    const b = (await res.json().catch(() => null)) as { error?: string } | null;
    setErr(b?.error ?? "Could not opt in.");
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-card border border-line bg-surface p-5">
      <h2 className="font-display text-lg font-bold">Join the leaderboards</h2>
      <p className="mt-1 text-sm text-muted">
        Boards rank <strong>consistency</strong> and <strong>personal records</strong> — never how heavy you
        lift. Your display name and these stats become visible to other members. You can leave anytime.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="eyebrow mb-1 block">Display name (optional)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={24}
            placeholder="Lifter#1234"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg focus:border-accent focus:outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="eyebrow mb-1 block">Birth year</span>
          <input
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 1998"
            className="num w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      <label className="mt-4 flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
        <span>
          I log my training honestly, I&apos;m old enough to participate, and I accept the{" "}
          <a href="/terms" className="text-accent hover:underline">Terms</a> and{" "}
          <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>.
        </span>
      </label>
      {err && <p role="alert" className="mt-3 text-sm text-hard">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join leaderboards"}
      </button>
    </form>
  );
}
