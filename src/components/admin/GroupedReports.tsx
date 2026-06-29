"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ReportGroupView = {
  targetType: string;
  targetId: string;
  reportedUserId: string | null;
  count: number;
  reasons: string[];
  latestAt: string; // ISO
};

export function GroupedReports({ groups }: { groups: ReportGroupView[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="eyebrow mb-2">Grouped by target · {groups.length}</h2>
      <ul className="space-y-2">
        {groups.map((g) => (
          <GroupRow key={`${g.targetType}:${g.targetId}`} group={g} />
        ))}
      </ul>
    </div>
  );
}

function GroupRow({ group }: { group: ReportGroupView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(outcome: "actioned" | "dismissed", suspend: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/reports/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: group.targetType,
          targetId: group.targetId,
          outcome,
          suspendUserId: suspend ? group.reportedUserId : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((d as { error?: string }).error ?? "Failed.");
        return;
      }
      setDone(outcome === "actioned" ? (suspend ? "Actioned · suspended" : "Actioned") : "Dismissed");
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-fg">
          <span className="font-semibold">{group.count}×</span> · {group.targetType}{" "}
          <span className="num text-faint">{group.targetId.slice(0, 8)}</span>
        </span>
        <span className="text-[11px] text-faint">{group.reasons.join(", ")}</span>
      </div>
      {done ? (
        <p aria-live="polite" className="mt-2 text-sm text-ok">{done}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {group.reportedUserId && (
            <button
              onClick={() => act("actioned", true)}
              disabled={busy}
              className="rounded-lg bg-hard px-3 py-1.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
            >
              Action all + suspend
            </button>
          )}
          <button
            onClick={() => act("actioned", false)}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-fg hover:bg-surface-2 disabled:opacity-60"
          >
            Action all
          </button>
          <button
            onClick={() => act("dismissed", false)}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-fg disabled:opacity-60"
          >
            Dismiss all
          </button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-hard">{err}</p>}
    </li>
  );
}
