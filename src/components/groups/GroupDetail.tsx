"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Shield, User, X, ArrowUp, ArrowDown, Copy, Check } from "lucide-react";

type Role = "owner" | "coach" | "member";
type Member = { userId: string; name: string; role: Role; sharesTrainingWithCoach: boolean };

export function GroupDetail({
  group,
  viewerId,
  viewerRole,
  viewerShares,
  members,
}: {
  group: { id: string; name: string; kind: "crew" | "coaching"; ownerId: string };
  viewerId: string;
  viewerRole: Role | null;
  viewerShares: boolean;
  members: Member[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shares, setShares] = useState(viewerShares);
  const [copied, setCopied] = useState(false);

  const post = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Something went wrong.");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (await post({ action: "join" })) router.refresh();
  };
  const leave = async () => {
    if (await post({ action: "leave" })) router.push("/groups");
  };
  const toggleConsent = async (next: boolean) => {
    setShares(next);
    if (!(await post({ action: "consent", shares: next }))) setShares(!next);
    else router.refresh();
  };
  const removeMember = async (targetUserId: string) => {
    if (await post({ action: "remove", targetUserId })) router.refresh();
  };
  const setRole = async (targetUserId: string, role: "coach" | "member") => {
    if (await post({ action: "setRole", targetUserId, role })) router.refresh();
  };
  const del = async () => {
    if (!window.confirm("Delete this group for everyone? This can't be undone.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Could not delete the group.");
        return;
      }
      router.push("/groups");
    } finally {
      setBusy(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(group.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const isOwner = viewerRole === "owner";
  const isCoaching = group.kind === "coaching";

  // Not a member yet — show a join prompt only.
  if (viewerRole === null) {
    return (
      <div className="glass mt-6 p-5">
        <p className="text-sm text-muted">You&apos;re not a member of this group.</p>
        <button onClick={join} disabled={busy} className="btn-accent mt-3 px-4 py-2 text-sm disabled:opacity-50">
          Join group
        </button>
        {err && <p role="alert" className="text-hard mt-2 text-sm">{err}</p>}
      </div>
    );
  }

  const roleIcon = (role: Role) =>
    role === "owner" ? <Crown className="h-3.5 w-3.5 text-accent" /> : role === "coach" ? <Shield className="h-3.5 w-3.5 text-data" /> : <User className="h-3.5 w-3.5 text-faint" />;

  return (
    <div className="mt-6 space-y-5">
      {/* invite / share */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <span className="eyebrow">invite people</span>
          <p className="num mt-0.5 break-all text-xs text-muted">{group.id}</p>
        </div>
        <button onClick={copyId} className="btn-surface inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
          {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy ID"}
        </button>
      </div>

      {/* coaching consent (coaching groups only) */}
      {isCoaching && (
        <label className="glass flex items-start gap-3 p-4">
          <input
            type="checkbox"
            checked={shares}
            onChange={(e) => toggleConsent(e.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span className="text-sm">
            <span className="font-medium text-fg">Share my training with this group&apos;s coaches</span>
            <span className="mt-0.5 block text-muted">
              Lets owners and coaches see your streak, consistency and last session. Off by default; turn it off any time.
            </span>
          </span>
        </label>
      )}

      {/* members */}
      <div>
        <h2 className="eyebrow mb-2">Members · {members.length}</h2>
        <ul className="card overflow-hidden p-0">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                {roleIcon(m.role)}
                <span className="truncate text-sm text-fg">{m.name}</span>
                {m.userId === viewerId && <span className="text-[11px] text-faint">(you)</span>}
                {isCoaching && m.sharesTrainingWithCoach && (
                  <span className="text-[11px] text-data">· sharing</span>
                )}
              </span>
              {isOwner && m.userId !== group.ownerId && (
                <span className="flex shrink-0 items-center gap-1">
                  {isCoaching &&
                    (m.role === "coach" ? (
                      <button
                        onClick={() => setRole(m.userId, "member")}
                        disabled={busy}
                        title="Demote to member"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-faint hover:text-muted"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setRole(m.userId, "coach")}
                        disabled={busy}
                        title="Promote to coach"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-faint hover:text-data"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  <button
                    onClick={() => removeMember(m.userId)}
                    disabled={busy}
                    title="Remove from group"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-faint hover:text-hard"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {err && <p role="alert" className="text-hard text-sm">{err}</p>}

      <div className="flex flex-wrap gap-3">
        {isOwner ? (
          <button onClick={del} disabled={busy} className="text-sm text-hard hover:underline disabled:opacity-50">
            Delete group
          </button>
        ) : (
          <button onClick={leave} disabled={busy} className="text-sm text-muted hover:text-fg disabled:opacity-50">
            Leave group
          </button>
        )}
      </div>
    </div>
  );
}
