import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getPublicProfile } from "@/db/social";
import { featureEnabledFor } from "@/lib/flags";
import { FollowButton } from "@/components/social/FollowButton";
import { ReportDialog } from "@/components/social/ReportDialog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await getUserById(session.user.id);
  if (!me) redirect("/login");
  if (!featureEnabledFor("social", me.featureAllowlist)) notFound();

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const profile = await getPublicProfile(session.user.id, id);
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <span className="eyebrow">Lifter</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{profile.name}</h1>
      <p className="mt-1.5 text-sm text-muted">
        Level {profile.level} · {profile.title} · joined {profile.joinedAt.toLocaleDateString()}
      </p>

      {profile.isSelf ? (
        <p className="mt-5 text-sm text-faint">This is how your public profile looks to others.</p>
      ) : (
        <div className="mt-5 flex items-center gap-3">
          <FollowButton targetUserId={profile.userId} initialFollowing={profile.isFollowing} />
          <ReportDialog targetType="user" targetId={profile.userId} reportedUserId={profile.userId} />
        </div>
      )}
    </div>
  );
}
