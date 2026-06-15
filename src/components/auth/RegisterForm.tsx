"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

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
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      setError(data.error ?? "Could not create account.");
      return;
    }
    // Auto sign-in after successful registration.
    const signin = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (signin?.error) {
      router.push("/login");
      return;
    }
    router.push("/log");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard">{error}</p>
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

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
  required = true,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={type === "password" ? 8 : undefined}
        className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-fg focus:border-accent focus:outline-none"
      />
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}
