"use client";

import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";

const REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["inappropriate", "Inappropriate"],
  ["impersonation", "Impersonation"],
  ["other", "Other"],
] as const;

type Reason = (typeof REASONS)[number][0];
type TargetType = "user" | "display_name" | "activity_event" | "caption";

// Compact "Report" affordance: a small flag button that opens an inline form posting to
// /api/reports. Used on feed items and group members. Once submitted it collapses to a
// thank-you so the same thing isn't reported repeatedly.
export function ReportDialog({
  targetType,
  targetId,
  reportedUserId,
  label = "Report",
}: {
  targetType: TargetType;
  targetId: string;
  reportedUserId?: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("spam");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reportedUserId: reportedUserId ?? null,
          reason,
          detail: detail.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((d as { error?: string }).error ?? "Could not submit report.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="text-[11px] text-faint">Reported · thanks</span>;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-hard"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Flag className="h-3 w-3" />
        {label}
      </button>
      {open && (
        <form
          onSubmit={submit}
          role="dialog"
          aria-label="Report content"
          className="glass absolute right-0 top-full z-40 mt-1 w-60 rounded-card p-3 shadow-lg"
        >
          <label className="eyebrow mb-1 block">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as Reason)}
            className="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
          >
            {REASONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Details (optional)"
            className="mt-2 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
          />
          {err && (
            <p role="alert" className="mt-1 text-xs text-hard">
              {err}
            </p>
          )}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-fg">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-accent px-3 py-1 text-xs disabled:opacity-60">
              {busy ? "Sending…" : "Submit"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
