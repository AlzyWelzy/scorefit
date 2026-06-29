"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

// Pragmatic session control: there's no per-device session registry (stateless JWT), but
// bumping tokenVersion invalidates ALL sessions at once. Signs the current device out too.
export function SignOutEverywhere() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (!window.confirm("Sign out of all devices? You'll need to log in again.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/sign-out-everywhere", { method: "POST" });
      if (!res.ok) {
        setErr("Couldn't do that. Try again.");
        return;
      }
      await signOut({ callbackUrl: "/login" });
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-medium text-fg">Sign out everywhere</p>
        <p className="text-xs text-muted">Ends every active session, including this one.</p>
      </div>
      <button onClick={go} disabled={busy} className="btn-surface px-3 py-1.5 text-sm text-hard disabled:opacity-60">
        {busy ? "…" : "Sign out all devices"}
      </button>
      {err && <p role="alert" className="text-hard w-full text-sm">{err}</p>}
    </div>
  );
}
