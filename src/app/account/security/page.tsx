import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listSecurityEvents } from "@/db/security";
import { listLoginSessions } from "@/db/users";
import { SignOutEverywhere } from "@/components/account/SignOutEverywhere";
import { SessionsList } from "@/components/account/SessionsList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Security activity",
  alternates: { canonical: "/account/security" },
  robots: { index: false, follow: false },
};

const LABEL: Record<string, string> = {
  password_changed: "Password changed",
  "2fa_enabled": "Two-factor enabled",
  "2fa_disabled": "Two-factor disabled",
  backup_codes_regenerated: "Backup codes regenerated",
  email_changed: "Email changed",
  signed_out_all: "Signed out of all devices",
  new_location: "Sign-in from a new location",
};

export default async function SecurityActivityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/security");
  const [events, sessions] = await Promise.all([
    listSecurityEvents(session.user.id),
    listLoginSessions(session.user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/account" className="text-xs text-muted hover:text-fg">
        ← Account
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Security activity</h1>
      <p className="mt-1.5 text-sm text-muted">
        Recent changes to your account credentials. If you don&apos;t recognise one, change your
        password right away.
      </p>

      <SignOutEverywhere />

      <SessionsList
        currentId={session.user.sessionId}
        sessions={sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          country: s.country,
          createdAt: s.createdAt.toISOString(),
          lastSeenAt: s.lastSeenAt.toISOString(),
        }))}
      />

      <h2 className="eyebrow mt-8 mb-2">Recent activity</h2>
      {events.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-10 text-center text-sm text-muted">
          No security activity recorded yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-1.5">
          {events.map((e) => (
            <li key={e.id} className="card flex items-baseline justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-fg">
                {LABEL[e.kind] ?? e.kind}
                {e.kind === "2fa_enabled" && e.meta && "method" in e.meta ? (
                  <span className="text-faint"> · {String(e.meta.method)}</span>
                ) : null}
              </span>
              <time className="text-[11px] text-faint" dateTime={e.createdAt.toISOString()}>
                {e.createdAt.toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
