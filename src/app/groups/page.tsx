import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getUserGroups } from "@/db/groups";
import { featureEnabledFor } from "@/lib/flags";
import { GroupsManager } from "@/components/groups/GroupsManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Groups",
  alternates: { canonical: "/groups" },
  robots: { index: false, follow: false },
};

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/groups");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");
  // Gated: SOCIAL_ENABLED globally, or the per-user allowlist (staged rollout).
  if (!featureEnabledFor("social", user.featureAllowlist)) notFound();

  const groups = await getUserGroups(session.user.id);
  const needsVerify = !user.emailVerified;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="eyebrow">Groups</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Train with your crew</h1>
      <p className="mt-1.5 text-sm text-muted">
        Crews to stay accountable, or coaching rosters where members can opt in to share their training.
      </p>
      <div className="mt-2 flex gap-3 text-xs">
        <Link href="/feed" className="text-data hover:underline">Feed →</Link>
        <Link href="/leaderboards" className="text-data hover:underline">Leaderboards →</Link>
      </div>

      {needsVerify && (
        <p className="mt-6 rounded-card border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Verify your email to create or join groups.{" "}
          <Link href="/account" className="underline">Verify now</Link>
        </p>
      )}

      <div className="mt-6">
        <GroupsManager disabled={needsVerify} />
      </div>

      <h2 className="eyebrow mt-10 mb-3">Your groups</h2>
      {groups.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-5 py-10 text-center text-sm text-muted">
          You&apos;re not in any groups yet. Create one above, or join with a shared group ID.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="card card-hover flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display font-semibold text-fg">{g.name}</span>
                  <span className="text-[11px] capitalize text-faint">
                    {g.kind} · {g.role}
                  </span>
                </span>
                <span className="num shrink-0 text-xs text-muted">
                  {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
