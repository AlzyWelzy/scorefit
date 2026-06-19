"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/auth/Field";

export function ResetPasswordForm({ email: initialEmail }: { email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many attempts. Please try again in a few minutes.");
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Invalid or expired code.");
        }
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p
          aria-live="polite"
          className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok"
        >
          Your password has been reset. You can sign in with it now.
        </p>
        <Link
          href="/login"
          className="btn-accent w-full"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard"
        >
          {error}
        </p>
      )}
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        inputMode="email"
      />
      <Field
        label="Reset code"
        type="text"
        value={code}
        onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        hint="The 6-digit code from your email."
      />
      <Field
        label="New password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      <Field
        label="Confirm new password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />
      <button
        type="submit"
        disabled={busy}
        className="btn-accent w-full disabled:opacity-60"
      >
        {busy ? "Resetting…" : "Reset password"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:text-accent-2">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
