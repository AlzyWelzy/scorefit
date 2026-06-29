"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Check } from "lucide-react";
import { Field } from "@/components/auth/Field";
import { TwoFactorSection } from "@/components/account/TwoFactorSection";

type Unit = "kg" | "lb";

const errorBox =
  "rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard";
const okBox =
  "rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok";
const submitBtn = "btn-accent w-full disabled:opacity-60";

/** Pulls a human-readable error out of a fetch Response. */
async function readError(res: Response): Promise<string> {
  if (res.status === 429) return "Too many attempts. Please try again in a few minutes.";
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? "Something went wrong. Please try again.";
}

export function AccountManager({
  name,
  email,
  unit,
  emailVerified,
  gamificationOptOut,
}: {
  name: string | null;
  email: string;
  unit: Unit;
  emailVerified: boolean;
  gamificationOptOut: boolean;
}) {
  return (
    <div className="space-y-5">
      <ProfileSection name={name} unit={unit} />
      <EmailSection email={email} emailVerified={emailVerified} />
      <TwoFactorSection />
      <GamificationSection optOut={gamificationOptOut} />
      <PasswordSection />
      <ExportSection />
      <DangerSection />
    </div>
  );
}

/* ------------------------------------------------------------------- Export */

function ExportSection() {
  return (
    <section className="glass p-5">
      <h2 className="eyebrow-accent">Export your data</h2>
      <p className="mt-3 text-sm text-muted">
        Download all your training data and account info.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href="/api/logs/export"
          download
          className="rounded-lg border border-line bg-bg px-4 py-2 text-sm font-semibold text-fg transition-all hover:border-accent/60 hover:text-accent"
        >
          Download CSV
        </a>
        <a
          href="/api/logs/export?format=json"
          download
          className="rounded-lg border border-line bg-bg px-4 py-2 text-sm font-semibold text-fg transition-all hover:border-accent/60 hover:text-accent"
        >
          Download JSON
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Gamification */

function GamificationSection({ optOut }: { optOut: boolean }) {
  const { update } = useSession();
  const [enabled, setEnabled] = useState(!optOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setSaved(false);
    // Optimistic; revert on failure so the control never lies about server state.
    setEnabled(next);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamificationOptOut: !next }),
      });
      if (!res.ok) {
        setEnabled(!next);
        setError(await readError(res));
        return;
      }
      await update();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setEnabled(!next);
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="eyebrow">Gamification</h2>
      <div className="mt-3 flex items-start justify-between gap-4">
        <p className="text-sm text-muted">
          XP, levels, streaks and achievements. Turn this off to use ScoreFit as a plain
          training log — no scores, no streak pressure. Doing so also removes you from
          the leaderboards. Your logs and progress are never affected.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Gamification"
          disabled={busy}
          onClick={() => toggle(!enabled)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-accent" : "bg-surface-2 border border-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {error && (
        <p role="alert" className={`mt-3 ${errorBox}`}>
          {error}
        </p>
      )}
      <span aria-live="polite" className="mt-2 block text-sm text-ok">
        {saved && (
          <span className="inline-flex items-center gap-1">
            <Check className="h-4 w-4" /> {enabled ? "Gamification on" : "Gamification off"}
          </span>
        )}
      </span>
    </section>
  );
}

/* ------------------------------------------------------------------ Profile */

function ProfileSection({ name, unit }: { name: string | null; unit: Unit }) {
  const { update } = useSession();
  const [displayName, setDisplayName] = useState(name ?? "");
  const [chosenUnit, setChosenUnit] = useState<Unit>(unit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName.trim() === "" ? null : displayName.trim(),
          unit: chosenUnit,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      await update();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass p-5">
      <h2 className="eyebrow-accent">Profile</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
        <Field
          label="Display name"
          type="text"
          value={displayName}
          onChange={setDisplayName}
          autoComplete="name"
          required={false}
          hint="Leave blank to remove your name."
        />
        <div>
          <span className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            Unit preference
          </span>
          <div
            role="group"
            aria-label="Unit preference"
            className="inline-flex overflow-hidden rounded-lg border border-line bg-bg text-sm"
          >
            {(["kg", "lb"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={chosenUnit === u}
                onClick={() => setChosenUnit(u)}
                className={`px-4 py-1.5 transition-all ${
                  chosenUnit === u
                    ? "bg-accent font-semibold text-bg glow-accent"
                    : "text-muted hover:text-fg"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={`${submitBtn} w-auto`}>
            {busy ? "Saving…" : "Save"}
          </button>
          <span aria-live="polite" className="text-sm text-ok">
            {saved && (
              <span className="inline-flex items-center gap-1">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
          </span>
        </div>
      </form>
    </section>
  );
}

/* -------------------------------------------------------------------- Email */

function EmailSection({
  email,
  emailVerified,
}: {
  email: string;
  emailVerified: boolean;
}) {
  const { update } = useSession();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    setChanged(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, currentPassword }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { emailChanged?: boolean };
      await update();
      setCurrentPassword("");
      if (data.emailChanged) {
        setChanged(true);
        setNewEmail("");
        setSuccess("Check your new inbox for a 6-digit verification code.");
      } else {
        setSuccess("No change — that's already your email.");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass p-5">
      <h2 className="eyebrow-accent">Email</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg px-3 py-2">
        <span className="num text-sm text-fg">{email}</span>
        {emailVerified ? (
          <span className="inline-flex items-center gap-1 text-xs text-ok">
            <Check className="h-3.5 w-3.5" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-warn">
            Unverified ·{" "}
            <Link href="/verify-email" className="underline hover:text-fg">
              Verify now
            </Link>
          </span>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
        {success && (
          <div aria-live="polite" className={okBox}>
            {success}
            {changed && (
              <>
                {" "}
                <Link href="/verify-email" className="underline">
                  Enter the code
                </Link>
              </>
            )}
          </div>
        )}
        <Field
          label="New email"
          type="email"
          value={newEmail}
          onChange={setNewEmail}
          autoComplete="email"
          inputMode="email"
        />
        <Field
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
          hint="Required to change your email."
        />
        <button type="submit" disabled={busy} className={`${submitBtn} w-auto`}>
          {busy ? "Updating…" : "Change email"}
        </button>
      </form>
    </section>
  );
}

/* ----------------------------------------------------------------- Password */

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      // Changing the password revokes all sessions (including this one) — sign
      // out cleanly here instead of letting the JWT be invalidated silently later.
      setTimeout(() => void signOut({ callbackUrl: "/login" }), 1500);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass p-5">
      <h2 className="eyebrow-accent">Password</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
        {success && (
          <p aria-live="polite" className={okBox}>
            Password updated. Signing you out — please sign in again.
          </p>
        )}
        <Field
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <Field
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
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
        <button type="submit" disabled={busy} className={`${submitBtn} w-auto`}>
          {busy ? "Updating…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

/* -------------------------------------------------------------- Danger zone */

function DangerSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: confirmText,
          password: password === "" ? undefined : password,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { scheduledFor?: string };
      setScheduledFor(data.scheduledFor ?? null);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletion() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/restore", { method: "POST" });
      if (res.ok) {
        setScheduledFor(null);
        setOpen(false);
        setConfirmText("");
        setPassword("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass border-hard/40 p-5">
      <h2 className="eyebrow text-hard">Danger zone</h2>
      <p className="mt-3 text-sm text-muted">
        Deleting your account schedules a permanent erasure after a 30-day grace period. You can
        cancel any time before then; after that, all logs and progress are gone for good.
      </p>

      {scheduledFor ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard">
            Scheduled for deletion on {new Date(scheduledFor).toLocaleDateString()}. You can cancel any
            time before then.
          </p>
          <button
            type="button"
            onClick={cancelDeletion}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            {busy ? "…" : "Cancel deletion"}
          </button>
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-hard/40 bg-hard/10 px-4 py-2 text-sm font-semibold text-hard transition-all hover:bg-hard/20 hover:border-hard/60"
        >
          Delete account
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          {error && (
            <p role="alert" className={errorBox}>
              {error}
            </p>
          )}
          <Field
            label='Type "DELETE" to confirm'
            type="text"
            value={confirmText}
            onChange={setConfirmText}
            autoComplete="off"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required={false}
            hint="Required if your account has a password."
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || confirmText !== "DELETE"}
              className="rounded-lg bg-hard px-4 py-2.5 font-semibold text-bg shadow-[0_4px_16px_-4px_rgba(255,80,80,0.5)] transition-all hover:opacity-90 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setConfirmText("");
                setPassword("");
              }}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
