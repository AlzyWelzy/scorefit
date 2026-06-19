"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type QueueReport = {
  id: string;
  reporterName: string | null;
  reportedUserId: string | null;
  reportedName: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string; // ISO
};

const card = "rounded-card border border-line bg-surface p-4";
const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60";

export function ReportQueue({ reports }: { reports: QueueReport[] }) {
  if (reports.length === 0) {
    return (
      <p className={`mt-6 ${card} text-center text-sm text-muted`}>
        No open reports. The queue is clear.
      </p>
    );
  }
  return (
    <ul className="mt-6 space-y-3">
      {reports.map((r) => (
        <ReportItem key={r.id} report={r} />
      ))}
    </ul>
  );
}

function ReportItem({ report }: { report: QueueReport }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function resolve(outcome: "actioned" | "dismissed", suspend: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          outcome,
          suspendUserId: suspend ? report.reportedUserId : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Could not resolve.");
        return;
      }
      setDone(outcome === "actioned" ? (suspend ? "Actioned · user suspended" : "Actioned") : "Dismissed");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold text-fg">{report.reason}</span>
          <span className="text-muted"> · {report.targetType}</span>
          {report.reportedName && <span className="text-muted"> · re: {report.reportedName}</span>}
        </div>
        <time className="num text-[11px] text-faint" dateTime={report.createdAt}>
          {new Date(report.createdAt).toLocaleString()}
        </time>
      </div>
      <p className="mt-1 text-xs text-muted">
        target <span className="num">{report.targetId}</span> · reported by{" "}
        {report.reporterName ?? "unknown"}
      </p>
      {report.detail && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">{report.detail}</p>}

      {error && <p role="alert" className="mt-2 text-sm text-hard">{error}</p>}
      {done ? (
        <p aria-live="polite" className="mt-3 text-sm text-ok">
          {done}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {report.reportedUserId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => resolve("actioned", true)}
              className={`${btn} bg-hard text-bg hover:opacity-90`}
            >
              Action + suspend social
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => resolve("actioned", false)}
            className={`${btn} border border-line text-fg hover:bg-surface-2`}
          >
            Action only
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => resolve("dismissed", false)}
            className={`${btn} border border-line text-muted hover:text-fg`}
          >
            Dismiss
          </button>
        </div>
      )}
    </li>
  );
}
