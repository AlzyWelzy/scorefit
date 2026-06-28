"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  suspended: boolean;
  gamificationOptOut: boolean;
  createdAt: string; // ISO
};

type Action = "suspend" | "unsuspend" | "grantAdmin" | "revokeAdmin" | "delete";

const card = "rounded-card border border-line bg-surface p-4";
const btn = "rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60";

export function UserAdmin({ users, selfId, searched }: { users: AdminUser[]; selfId: string; searched: boolean }) {
  if (!searched) {
    return <p className={`mt-6 ${card} text-center text-sm text-muted`}>Search for a user by email or display name.</p>;
  }
  if (users.length === 0) {
    return <p className={`mt-6 ${card} text-center text-sm text-muted`}>No users match that search.</p>;
  }
  return (
    <ul className="mt-6 space-y-2">
      {users.map((u) => (
        <UserRow key={u.id} user={u} selfId={selfId} />
      ))}
    </ul>
  );
}

function UserRow({ user, selfId }: { user: AdminUser; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isSelf = user.id === selfId;

  async function act(action: Action) {
    if (action === "delete" && !window.confirm(`Permanently delete ${user.email} and all their data? This cannot be undone.`)) {
      return;
    }
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((d as { error?: string }).error ?? "Action failed.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className={card}>
      <div className="min-w-0">
        <p className="truncate text-sm text-fg">
          {user.displayName || "—"} <span className="text-faint">· {user.email}</span>
          {isSelf && <span className="ml-1 text-[11px] text-accent">you</span>}
        </p>
        <p className="text-[11px] text-faint">
          {user.isAdmin && <span className="text-accent">admin · </span>}
          {user.suspended && <span className="text-hard">social-suspended · </span>}
          {user.gamificationOptOut && "gamification off · "}
          joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>

      {err && <p role="alert" className="mt-2 text-xs text-hard">{err}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {user.suspended ? (
          <button onClick={() => act("unsuspend")} disabled={!!busy} className={`${btn} text-ok hover:bg-surface-2`}>
            {busy === "unsuspend" ? "…" : "Un-suspend social"}
          </button>
        ) : (
          <button onClick={() => act("suspend")} disabled={!!busy} className={`${btn} text-hard hover:bg-surface-2`}>
            {busy === "suspend" ? "…" : "Suspend social"}
          </button>
        )}

        {user.isAdmin
          ? !isSelf && (
              <button onClick={() => act("revokeAdmin")} disabled={!!busy} className={`${btn} text-muted hover:bg-surface-2`}>
                {busy === "revokeAdmin" ? "…" : "Revoke admin"}
              </button>
            )
          : (
            <button onClick={() => act("grantAdmin")} disabled={!!busy} className={`${btn} text-accent hover:bg-surface-2`}>
              {busy === "grantAdmin" ? "…" : "Make admin"}
            </button>
          )}

        {!isSelf && (
          <button onClick={() => act("delete")} disabled={!!busy} className={`${btn} border-hard/40 text-hard hover:bg-hard/10`}>
            {busy === "delete" ? "…" : "Delete"}
          </button>
        )}
      </div>
    </li>
  );
}
