"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MailWarning } from "lucide-react";

// Soft gate for signed-in, unverified users. Gates on the LIVE account status
// (DB-backed /api/account/status), never the session JWT — so it shows the
// truth on first paint and disappears the moment the email is verified, even
// if the JWT hasn't been re-minted yet. Self-gating keeps the root layout static.
export function VerifyBanner() {
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account/status", { cache: "no-store" });
      if (!res.ok) {
        setShow(false);
        return;
      }
      const data = (await res.json()) as { authenticated: boolean; verified?: boolean };
      setShow(data.authenticated && data.verified === false);
    } catch {
      setShow(false);
    }
  }, []);

  useEffect(() => {
    // Fetch live status on mount and subscribe to focus/verified events.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onFocus = () => void refresh();
    const onVerified = () => setShow(false);
    window.addEventListener("focus", onFocus);
    // The verify form dispatches this on success for an instant dismiss.
    window.addEventListener("scorefit-email-verified", onVerified);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("scorefit-email-verified", onVerified);
    };
  }, [refresh]);

  if (!show) return null;

  async function resend() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/verify-email", { method: "PUT" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Could not resend.");
      } else {
        setSent(true);
      }
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-warn/20 bg-warn/10 px-5 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <MailWarning className="h-4 w-4 shrink-0 text-warn" />
        <span className="text-fg">Verify your email to secure your account.</span>
        <Link href="/verify-email" className="font-semibold text-warn underline">
          Enter code
        </Link>
        <span className="text-faint">·</span>
        {sent ? (
          <span className="text-muted">New code sent.</span>
        ) : (
          <button onClick={resend} disabled={busy} className="text-muted underline hover:text-fg disabled:opacity-60">
            {busy ? "Sending…" : "Resend code"}
          </button>
        )}
        {err && <span className="text-hard">{err}</span>}
      </div>
    </div>
  );
}
