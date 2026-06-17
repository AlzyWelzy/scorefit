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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, email, password }),
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
    // email verification), fails if the email already existed with a
    // different password (send them to login instead).
    const signin = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (signin?.error) {
      router.push("/login");
      return;
    }
    router.push("/verify-email");
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
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-bg transition-colors hover:bg-accent-2 disabled:opacity-60"
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
