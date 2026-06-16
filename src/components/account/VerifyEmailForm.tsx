"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const RESEND_COOLDOWN = 30;

export function VerifyEmailForm() {
  const router = useRouter();
  const { update } = useSession();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const counting = cooldown > 0;

  // Tick the resend cooldown down to zero while it is active.
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [counting]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/account/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many attempts. Please try again in a few minutes.");
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Invalid code.");
        }
        return;
      }
      // Instantly dismiss the verify banner, refresh the session JWT, then go.
      window.dispatchEvent(new CustomEvent("scorefit-email-verified"));
      await update();
      router.push("/log");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/account/verify-email", { method: "PUT" });
      if (!res.ok) {
        if (res.status === 429) {
          setError("Please wait before requesting another code.");
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Could not resend the code.");
        }
        return;
      }
      setNotice("A new code is on its way.");
      setCooldown(RESEND_COOLDOWN);
    } catch {
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
      {notice && (
        <p
          aria-live="polite"
          className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok"
        >
          {notice}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
          Verification code
        </span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          aria-label="6-digit verification code"
          className="num w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-2xl tracking-[0.5em] text-center text-fg focus:border-accent focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-bg transition-colors hover:bg-accent-2 disabled:opacity-60"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="w-full text-center text-sm text-muted transition-colors hover:text-fg disabled:opacity-60"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
    </form>
  );
}
