"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/auth/Field";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Enumeration-safe: a 200 says nothing about whether the account exists.
      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many attempts. Please try again in a few minutes.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p
          aria-live="polite"
          className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok"
        >
          If that email has an account, a reset code is on its way.
        </p>
        <Link
          href={`/reset-password?email=${encodeURIComponent(email)}`}
          className="btn-accent w-full"
        >
          I have a code — continue
        </Link>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="text-accent hover:text-accent-2">
            Back to sign in
          </Link>
        </p>
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
      <button
        type="submit"
        disabled={busy}
        className="btn-accent w-full disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send reset code"}
      </button>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-accent hover:text-accent-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
