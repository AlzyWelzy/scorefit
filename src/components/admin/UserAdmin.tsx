"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "user" | "moderator" | "admin";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  role: Role;
  suspended: boolean;
  gamificationOptOut: boolean;
  createdAt: string; // ISO
};

const card = "rounded-card border border-line bg-surface p-4";
const btn = "rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60";

export function UserAdmin({
  users,
  selfId,
  viewerIsAdmin,
  searched,
}: {
  users: AdminUser[];
  selfId: string;
  viewerIsAdmin: boolean;
  searched: boolean;
}) {
  if (!searched) {
    return <p className={`mt-6 ${card} text-center text-sm text-muted`}>Search for a user by email or display name.</p>;
  }
  if (users.length === 0) {
    return <p className={`mt-6 ${card} text-center text-sm text-muted`}>No users match that search.</p>;
  }
  return (
    <ul className="mt-6 space-y-2">
      {users.map((u) => (
        <UserRow key={u.id} user={u} selfId={selfId} viewerIsAdmin={viewerIsAdmin} />
      ))}
    </ul>
  );
}

function UserRow({ user, selfId, viewerIsAdmin }: { user: AdminUser; selfId: string; viewerIsAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isSelf = user.id === selfId;

  async function act(action: string, role?: Role) {
    if (action === "delete" && !window.confirm(`Permanently delete ${user.email} and all their data? This cannot be undone.`)) {
      return;
    }
    setBusy(action + (role ?? ""));
    setErr(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action, role }),
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

  const roleLabel = user.role === "admin" ? "admin" : user.role === "moderator" ? "moderator" : null;

  return (
    <li className={card}>
      <div className="min-w-0">
        <p className="truncate text-sm text-fg">
          {user.displayName || "—"} <span className="text-faint">· {user.email}</span>
          {isSelf && <span className="ml-1 text-[11px] text-accent">you</span>}
        </p>
        <p className="text-[11px] text-faint">
          {roleLabel && <span className="text-accent">{roleLabel} · </span>}
          {user.suspended && <span className="text-hard">social-suspended · </span>}
          {user.gamificationOptOut && "gamification off · "}
          joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>

      {err && <p role="alert" className="mt-2 text-xs text-hard">{err}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {user.suspended ? (
          <button onClick={() => act("unsuspend")} disabled={!!busy} className={`${btn} text-ok hover:bg-surface-2`}>
            {busy === "unsuspend" ? "…" : "Un-suspend social"}
          </button>
        ) : (
          <button onClick={() => act("suspend")} disabled={!!busy} className={`${btn} text-hard hover:bg-surface-2`}>
            {busy === "suspend" ? "…" : "Suspend social"}
          </button>
        )}

        {/* Role is admin-only (and never on yourself, to avoid self-lockout). */}
        {viewerIsAdmin && !isSelf && (
          <span className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Set role">
            {(["user", "moderator", "admin"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => act("setRole", r)}
                disabled={!!busy || user.role === r}
                title={`Set role: ${r}`}
                className={`px-2.5 py-1.5 text-xs capitalize transition-colors ${
                  user.role === r ? "bg-accent text-bg" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {r}
              </button>
            ))}
          </span>
        )}

        {viewerIsAdmin && !isSelf && (
          <button onClick={() => act("delete")} disabled={!!busy} className={`${btn} border-hard/40 text-hard hover:bg-hard/10`}>
            {busy === "delete" ? "…" : "Delete"}
          </button>
        )}
      </div>
    </li>
  );
}
