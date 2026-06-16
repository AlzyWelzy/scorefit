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
const submitBtn =
  "w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-bg transition-colors hover:bg-accent-2 disabled:opacity-60";

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
}: {
  name: string | null;
  email: string;
  unit: Unit;
  emailVerified: boolean;
}) {
  return (
    <div className="space-y-5">
      <ProfileSection name={name} unit={unit} />
      <EmailSection email={email} emailVerified={emailVerified} />
      <TwoFactorSection />
      <PasswordSection />
      <DangerSection />
    </div>
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
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="eyebrow">Profile</h2>
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
            className="inline-flex overflow-hidden rounded-lg border border-line text-sm"
          >
            {(["kg", "lb"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={chosenUnit === u}
                onClick={() => setChosenUnit(u)}
                className={`px-4 py-1.5 transition-colors ${
                  chosenUnit === u ? "bg-accent text-bg" : "text-muted hover:text-fg"
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
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="eyebrow">Email</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-fg">{email}</span>
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
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="eyebrow">Password</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
        {success && (
          <p aria-live="polite" className={okBox}>
            Password updated.
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
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-hard/30 bg-surface p-5">
      <h2 className="eyebrow text-hard">Danger zone</h2>
      <p className="mt-3 text-sm text-muted">
        Deleting your account is permanent. All of your workout logs and progress
        are erased and cannot be recovered.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-hard/30 bg-hard/10 px-4 py-2 text-sm font-semibold text-hard transition-colors hover:bg-hard/20"
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
              className="rounded-lg bg-hard px-4 py-2.5 font-semibold text-bg transition-colors hover:opacity-90 disabled:opacity-60"
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
              className="rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
