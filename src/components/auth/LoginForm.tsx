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
    const target = safeInternalPath(callbackUrl, "/log");
    try {
      // Step 1: verify the password and find out if a second factor is needed.
      const start = await fetch("/api/auth/2fa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!start.ok) {
        setBusy(false);
        if (start.status === 429) setError("Too many attempts. Try again in a few minutes.");
        else setError("Invalid email or password.");
        return;
      }
      const data = (await start.json()) as { next: "signin" | "2fa"; method?: "email" | "totp" };

      if (data.next === "2fa") {
        // Hand off to the second-factor challenge. The password is stashed in
        // sessionStorage (same-origin, wiped right after sign-in) so it isn't
        // placed in the URL; the pending cookie binds the step to this user.
        try {
          sessionStorage.setItem("sf_2fa", JSON.stringify({ email, password }));
        } catch {
          /* private mode — the 2fa page will ask for the password again */
        }
        const params = new URLSearchParams({ callbackUrl: target, method: data.method ?? "totp" });
        router.push(`/login/2fa?${params.toString()}`);
        return;
      }

      // No 2FA — issue the session now.
      const res = await signIn("credentials", { email, password, redirect: false });
      setBusy(false);
      if (res?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push(target);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Something went wrong. Check your connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard">
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
