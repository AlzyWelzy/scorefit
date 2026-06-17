"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function TwoFactorChallenge({
  callbackUrl,
  method,
}: {
  callbackUrl: string;
  method: "email" | "totp";
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  // Recover the password stashed by the login form (same-origin sessionStorage).
  // Read once during init — `creds` never affects markup, so there is no
  // hydration mismatch and no setState-in-effect is needed.
  const [creds] = useState<{ email: string; password: string } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("sf_2fa");
      return raw ? (JSON.parse(raw) as { email: string; password: string }) : null;
    } catch {
      return null;
    }
  });
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!creds) {
      setError("Your session timed out. Please sign in again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: creds.email,
        password: creds.password,
        code: code.trim(),
        redirect: false,
      });
      if (res?.error) {
        setBusy(false);
        setError("That code didn't work. Try again or use a backup code.");
        return;
      }
      try {
        sessionStorage.removeItem("sf_2fa");
      } catch {
        /* ignore */
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Something went wrong. Try again.");
    }
  }

  async function resend() {
    if (!creds) return;
    setResent(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: creds.email, password: creds.password }),
      });
      if (res.ok) setResent(true);
      else setError("Could not resend the code.");
    } catch {
      setError("Network error.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard">
          {error}
        </p>
      )}
      <label className="block">
        <span className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
          {useBackup ? "Backup code" : "6-digit code"}
        </span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          maxLength={useBackup ? 9 : 6}
          placeholder={useBackup ? "XXXX-XXXX" : "123456"}
          required
          autoFocus
          aria-label={useBackup ? "Backup code" : "Two-factor code"}
          className="num w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-center text-2xl tracking-[0.4em] text-data shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3),0_0_0_3px_color-mix(in_srgb,var(--color-accent)_22%,transparent)] focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="btn-accent w-full px-4 py-2.5 font-semibold disabled:opacity-60"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>

      <div aria-live="polite" className="flex flex-col items-center gap-1 text-center text-sm">
        {method === "email" && !useBackup && (
          <button type="button" onClick={resend} className="text-muted underline hover:text-fg">
            {resent ? "Code resent" : "Resend code"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setUseBackup((v) => !v);
            setCode("");
            setError(null);
          }}
          className="text-muted underline hover:text-fg"
        >
          {useBackup ? "Use your authenticator / email code" : "Use a backup code instead"}
        </button>
      </div>
    </form>
  );
}
