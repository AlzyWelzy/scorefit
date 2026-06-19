"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Field } from "./Field";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentYear = new Date().getFullYear();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Birth year is required so the age cohort is known at signup. It never blocks
    // the account itself — it gates public/social surfaces — but we ask for a sane
    // 4-digit year here so the value we store is meaningful.
    const by = Number(birthYear);
    if (!Number.isInteger(by) || by < 1900 || by > currentYear) {
      setError("Please enter a valid birth year.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, email, password, birthYear: by }),
    });

    if (!res.ok) {
      setBusy(false);
      if (res.status === 429) {
        setError("Too many attempts. Please try again in a few minutes.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create account.");
      return;
    }

    // The register API is enumeration-safe: it always returns { ok: true }.
    // Try to sign in — succeeds for genuinely new accounts (which land on
    // onboarding), fails if the email already existed with a different password
    // (send them to login instead).
    const signin = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (signin?.error) {
      router.push("/login");
      return;
    }
    // New accounts go to onboarding (choose program/week/unit); the verify-email
    // banner still nudges verification globally. /onboarding skips to /log if already set.
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard">{error}</p>
      )}
      <Field label="Name (optional)" type="text" value={name} onChange={setName} autoComplete="name" required={false} />
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      <Field
        label="Birth year"
        type="number"
        value={birthYear}
        onChange={setBirthYear}
        autoComplete="bday-year"
        inputMode="numeric"
        hint="Used only to confirm your age for public features. We never store your full date of birth."
      />
      <button
        type="submit"
        disabled={busy}
        className="btn-accent w-full px-4 py-2.5 font-semibold disabled:opacity-60"
      >
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:text-accent-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
