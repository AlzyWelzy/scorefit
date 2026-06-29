"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

// Site-wide reminder while an account deletion is pending, with a one-click cancel.
// Reads the live DB-backed status (same source as the verify banner).
export function DeletionBanner() {
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account/status", { cache: "no-store" });
      if (!res.ok) {
        setScheduledFor(null);
        return;
      }
      const d = (await res.json()) as { authenticated?: boolean; deletionScheduledAt?: string | null };
      setScheduledFor(d.authenticated && d.deletionScheduledAt ? d.deletionScheduledAt : null);
    } catch {
      setScheduledFor(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch("/api/account/restore", { method: "POST" });
      if (res.ok) setScheduledFor(null);
    } finally {
      setBusy(false);
    }
  }

  if (!scheduledFor) return null;
  const date = new Date(scheduledFor).toLocaleDateString();

  return (
    <div className="border-b border-hard/25 bg-hard/10 px-5 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Trash2 className="h-4 w-4 shrink-0 text-hard" />
        <span className="text-fg">Your account is scheduled for deletion on {date}.</span>
        <button onClick={cancel} disabled={busy} className="font-semibold text-hard underline disabled:opacity-60">
          {busy ? "…" : "Cancel deletion"}
        </button>
      </div>
    </div>
  );
}
