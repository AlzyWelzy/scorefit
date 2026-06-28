import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getGroup, getMembership, getGroupMembers } from "@/db/groups";
import { featureEnabledFor } from "@/lib/flags";
import { GroupDetail } from "@/components/groups/GroupDetail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Group",
  robots: { index: false, follow: false },
};

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/groups");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");
  if (!featureEnabledFor("social", user.featureAllowlist)) notFound();

  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const membership = await getMembership(id, session.user.id);
  // Only members see the roster; non-members get the join prompt inside GroupDetail.
  const members = membership ? await getGroupMembers(id) : [];
  const canCoach =
    membership && group.kind === "coaching" && (membership.role === "owner" || membership.role === "coach");

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/groups" className="text-xs text-muted hover:text-fg">
        ← All groups
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{group.name}</h1>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] capitalize text-muted">
          {group.kind}
        </span>
      </div>
      {canCoach && (
        <Link href={`/groups/${group.id}/coach`} className="mt-2 inline-block text-sm text-data hover:underline">
          Open coach dashboard →
        </Link>
      )}

      <GroupDetail
        group={{ id: group.id, name: group.name, kind: group.kind, ownerId: group.ownerId }}
        viewerId={session.user.id}
        viewerRole={membership?.role ?? null}
        viewerShares={membership?.sharesTrainingWithCoach ?? false}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          role: m.role,
          sharesTrainingWithCoach: m.sharesTrainingWithCoach,
        }))}
      />
    </div>
  );
}
