"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Field } from "@/components/auth/Field";

type Method = "email" | "totp";

type Status = {
  enabled: boolean;
  method: Method | null;
  backupCodesRemaining: number;
};

type TotpSetup = {
  method: "totp";
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
};

const errorBox =
  "rounded-lg border border-hard/30 bg-hard/10 px-3 py-2 text-sm text-hard";
const okBox = "rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok";
const submitBtn =
  "rounded-lg bg-accent px-4 py-2.5 font-semibold text-bg transition-colors hover:bg-accent-2 disabled:opacity-60";
const ghostBtn =
  "rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:text-fg disabled:opacity-60";
const codeInput =
  "num w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-2xl tracking-[0.5em] text-center text-fg focus:border-accent focus:outline-none";

const METHOD_LABEL: Record<Method, string> = {
  totp: "Authenticator app",
  email: "Email code",
};

/** Pulls a human-readable error out of a fetch Response. */
async function readError(res: Response): Promise<string> {
  if (res.status === 429)
    return "Too many attempts. Please try again in a few minutes.";
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? "Something went wrong. Please try again.";
}

/** Keeps only digits, max 6 — matches the OTP input convention used elsewhere. */
function onlyDigits(v: string): string {
  return v.replace(/\D/g, "").slice(0, 6);
}

export function TwoFactorSection() {
  const { update } = useSession();

  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The method currently being set up (disabled→setup, or switching method).
  const [setupMethod, setSetupMethod] = useState<Method | null>(null);
  const [totp, setTotp] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState("");

  // Backup codes are shown exactly once, right after a confirm or regenerate.
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Disable-2FA sub-flow.
  const [disableOpen, setDisableOpen] = useState(false);

  // Generic per-action busy/error.
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load current 2FA state on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/account/2fa");
        if (!res.ok) {
          if (active) setLoadError(await readError(res));
          return;
        }
        const data = (await res.json()) as Status;
        if (active) setStatus(data);
      } catch {
        if (active)
          setLoadError("Couldn't load your security settings. Refresh to try again.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function resetSetup() {
    setSetupMethod(null);
    setTotp(null);
    setCode("");
    setActionError(null);
  }

  // Begin (or switch to) setup for a method.
  async function beginSetup(method: Method) {
    setBusy(true);
    setActionError(null);
    setBackupCodes(null);
    setTotp(null);
    setCode("");
    try {
      const res = await fetch("/api/account/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        setActionError(await readError(res));
        return;
      }
      const data = await res.json();
      if (method === "totp") {
        setTotp(data as TotpSetup);
      }
      setSetupMethod(method);
    } catch {
      setActionError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // Confirm the 6-digit code → activates 2FA and returns backup codes.
  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupMethod) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: setupMethod, code }),
      });
      if (!res.ok) {
        setActionError(await readError(res));
        return;
      }
      const data = (await res.json()) as { ok: true; method: Method; backupCodes: string[] };
      await update();
      setStatus({
        enabled: true,
        method: data.method,
        backupCodesRemaining: data.backupCodes.length,
      });
      setBackupCodes(data.backupCodes);
      // Clear the setup form — codes screen takes over until "Done".
      setSetupMethod(null);
      setTotp(null);
      setCode("");
    } catch {
      setActionError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateBackupCodes() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account/2fa/backup-codes", { method: "POST" });
      if (!res.ok) {
        setActionError(await readError(res));
        return;
      }
      const data = (await res.json()) as { ok: true; backupCodes: string[] };
      setBackupCodes(data.backupCodes);
      setStatus((prev) =>
        prev ? { ...prev, backupCodesRemaining: data.backupCodes.length } : prev,
      );
    } catch {
      setActionError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa(password: string) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setActionError(await readError(res));
        return false;
      }
      await update();
      setStatus({ enabled: false, method: null, backupCodesRemaining: 0 });
      setDisableOpen(false);
      setBackupCodes(null);
      resetSetup();
      return true;
    } catch {
      setActionError("Something went wrong. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="eyebrow">Two-factor authentication</h2>

      {/* ---- Loading ---- */}
      {status === null && loadError === null && (
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          Loading…
        </p>
      )}

      {loadError && (
        <p role="alert" className={`mt-3 ${errorBox}`}>
          {loadError}
        </p>
      )}

      {status && (
        <div className="mt-3 space-y-4" aria-live="polite">
          {/* ---- Backup codes screen (after confirm / regenerate) ---- */}
          {backupCodes ? (
            <BackupCodes
              codes={backupCodes}
              onDone={() => setBackupCodes(null)}
            />
          ) : setupMethod ? (
            /* ---- Setup sub-flow (TOTP or email) ---- */
            <SetupFlow
              method={setupMethod}
              totp={totp}
              code={code}
              onCode={(v) => setCode(onlyDigits(v))}
              onSubmit={confirmSetup}
              busy={busy}
              error={actionError}
              onCancel={() => {
                resetSetup();
              }}
            />
          ) : status.enabled ? (
            /* ---- Enabled state ---- */
            <EnabledState
              status={status}
              busy={busy}
              error={actionError}
              disableOpen={disableOpen}
              onSwitch={(m) => beginSetup(m)}
              onRegenerate={regenerateBackupCodes}
              onOpenDisable={() => {
                setActionError(null);
                setDisableOpen(true);
              }}
              onCancelDisable={() => {
                setActionError(null);
                setDisableOpen(false);
              }}
              onDisable={disable2fa}
            />
          ) : (
            /* ---- Disabled state ---- */
            <DisabledState busy={busy} error={actionError} onChoose={beginSetup} />
          )}
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- Disabled */

function DisabledState({
  busy,
  error,
  onChoose,
}: {
  busy: boolean;
  error: string | null;
  onChoose: (m: Method) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Add a second step when you sign in. We'll ask for a one-time code in
        addition to your password, so your account stays safe even if your
        password leaks.
      </p>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <MethodChoice
          title="Authenticator app (TOTP)"
          desc="Use Google Authenticator, 1Password, or similar."
          disabled={busy}
          onClick={() => onChoose("totp")}
        />
        <MethodChoice
          title="Email code"
          desc="We email a 6-digit code each time you sign in."
          disabled={busy}
          onClick={() => onChoose("email")}
        />
      </div>
    </div>
  );
}

function MethodChoice({
  title,
  desc,
  disabled,
  onClick,
}: {
  title: string;
  desc: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-line bg-bg p-4 text-left transition-colors hover:border-accent disabled:opacity-60"
    >
      <span className="block font-display text-sm font-semibold text-fg">
        {title}
      </span>
      <span className="mt-1 block text-xs text-muted">{desc}</span>
    </button>
  );
}

/* -------------------------------------------------------------------- Setup */

function SetupFlow({
  method,
  totp,
  code,
  onCode,
  onSubmit,
  busy,
  error,
  onCancel,
}: {
  method: Method;
  totp: TotpSetup | null;
  code: string;
  onCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg">
        Set up <span className="font-semibold">{METHOD_LABEL[method]}</span>.
      </p>

      {method === "totp" && totp && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Scan this QR code with your authenticator app.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={totp.qrDataUrl}
            alt="QR code for two-factor authentication"
            width={176}
            height={176}
            className="rounded-lg border border-line bg-white p-2"
          />
          <div>
            <span className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
              Can't scan? Enter this key
            </span>
            <code className="num block break-all rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg">
              {totp.secret}
            </code>
          </div>
        </div>
      )}

      {method === "email" && (
        <p className="text-sm text-muted">
          We've emailed you a 6-digit code. Enter it below to finish enabling
          two-factor authentication.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
        <label className="block">
          <span className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            {method === "totp"
              ? "Enter the code from your app"
              : "Enter the emailed code"}
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => onCode(e.target.value)}
            required
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            aria-label="6-digit confirmation code"
            className={codeInput}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className={submitBtn}
          >
            {busy ? "Confirming…" : "Confirm & enable"}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------- Backup codes */

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the codes are still visible to copy by hand */
    }
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 text-sm text-ok">
        <ShieldCheck className="h-4 w-4" />
        Two-factor authentication is on.
      </div>

      <p role="alert" className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
        Save these now — each code works once and they won't be shown again. Use
        them to sign in if you lose access to your device.
      </p>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {codes.map((c, i) => (
          <li
            key={`${c}-${i}`}
            className="num rounded-lg border border-line bg-bg px-2 py-2 text-center text-sm text-fg"
          >
            {c}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button type="button" onClick={onDone} className={submitBtn}>
          Done
        </button>
        <button type="button" onClick={copy} className={`${ghostBtn} inline-flex items-center gap-1.5`}>
          {copied ? (
            <>
              <Check className="h-4 w-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Enabled */

function EnabledState({
  status,
  busy,
  error,
  disableOpen,
  onSwitch,
  onRegenerate,
  onOpenDisable,
  onCancelDisable,
  onDisable,
}: {
  status: Status;
  busy: boolean;
  error: string | null;
  disableOpen: boolean;
  onSwitch: (m: Method) => void;
  onRegenerate: () => void;
  onOpenDisable: () => void;
  onCancelDisable: () => void;
  onDisable: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const active = status.method;
  const other: Method | null =
    active === "totp" ? "email" : active === "email" ? "totp" : null;

  async function submitDisable(e: React.FormEvent) {
    e.preventDefault();
    const ok = await onDisable(password);
    if (ok) setPassword("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm text-ok">
          <ShieldCheck className="h-4 w-4" /> 2FA is on
        </span>
        {active && (
          <span className="text-xs text-muted">
            Method: <span className="text-fg">{METHOD_LABEL[active]}</span> ·{" "}
            <span className="num">{status.backupCodesRemaining}</span> backup
            code{status.backupCodesRemaining === 1 ? "" : "s"} left
          </span>
        )}
      </div>

      {error && !disableOpen && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}

      {/* Switch method */}
      {other && (
        <div className="space-y-2">
          <span className="block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            Switch method
          </span>
          <p className="text-xs text-muted">
            Switching to {METHOD_LABEL[other]} requires re-confirming a code
            before it takes effect.
          </p>
          <button
            type="button"
            onClick={() => onSwitch(other)}
            disabled={busy}
            className={ghostBtn}
          >
            Switch to {METHOD_LABEL[other]}
          </button>
        </div>
      )}

      {/* Regenerate backup codes */}
      <div className="space-y-2">
        <span className="block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
          Backup codes
        </span>
        <p className="text-xs text-muted">
          Generate a fresh set of one-time codes. This invalidates your existing
          codes.
        </p>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className={ghostBtn}
        >
          {busy ? "Working…" : "Regenerate backup codes"}
        </button>
      </div>

      {/* Disable 2FA */}
      <div className="space-y-2 border-t border-line pt-4">
        <span className="block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-warn">
          Turn off two-factor
        </span>
        {!disableOpen ? (
          <button
            type="button"
            onClick={onOpenDisable}
            disabled={busy}
            className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-2 text-sm font-semibold text-warn transition-colors hover:bg-warn/20 disabled:opacity-60"
          >
            Disable 2FA
          </button>
        ) : (
          <form onSubmit={submitDisable} className="space-y-3">
            <p className="text-xs text-muted">
              Disabling two-factor authentication makes your account less secure.
              Confirm your password to continue.
            </p>
            {error && (
              <p role="alert" className={errorBox}>
                {error}
              </p>
            )}
            <Field
              label="Current password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy || password.length === 0}
                className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn transition-colors hover:bg-warn/20 disabled:opacity-60"
              >
                {busy ? "Disabling…" : "Disable 2FA"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPassword("");
                  onCancelDisable();
                }}
                disabled={busy}
                className={ghostBtn}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
