"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Session = {
  id: string;
  userAgent: string | null;
  country: string | null;
  createdAt: string;
  lastSeenAt: string;
};

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export function SessionsList({ sessions, currentId }: { sessions: Session[]; currentId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (sessions.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="eyebrow mb-2">Active sessions</h2>
      <ul className="space-y-1.5">
        {sessions.map((s) => {
          const isCurrent = s.id === currentId;
          return (
            <li key={s.id} className="card flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0 text-sm">
                <span className="text-fg">{deviceLabel(s.userAgent)}</span>
                {s.country && <span className="text-faint"> · {s.country}</span>}
                {isCurrent && <span className="ml-1 text-[11px] text-accent">this device</span>}
                <span className="block text-[11px] text-faint">
                  last seen {new Date(s.lastSeenAt).toLocaleString()}
                </span>
              </span>
              {!isCurrent && (
                <button
                  onClick={() => revoke(s.id)}
                  disabled={busy === s.id}
                  className="btn-surface px-3 py-1.5 text-xs text-hard disabled:opacity-60"
                >
                  {busy === s.id ? "…" : "Revoke"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
