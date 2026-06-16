"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Field } from "./Field";
import { safeInternalPath } from "@/lib/safeRedirect";

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
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      setBusy(false);
      if (res?.error) {
        setError("Invalid email or password.");
        return;
      }
      // Re-validate the redirect target on the client too (defence in depth).
      router.push(safeInternalPath(callbackUrl, "/log"));
      router.refresh();
    } catch {
      setBusy(false);
      setError("Something went wrong. Check your connection and try again.");
    }
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
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" inputMode="email" />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <div className="text-right">
        <Link href="/forgot-password" className="text-xs text-muted hover:text-fg">
          Forgot password?
        </Link>
      </div>
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
