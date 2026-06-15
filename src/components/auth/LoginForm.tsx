"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard">{error}</p>
      )}
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-bg transition-colors hover:bg-accent-2 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="text-accent hover:text-accent-2">
          Create one
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
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-fg focus:border-accent focus:outline-none"
      />
    </label>
  );
}
