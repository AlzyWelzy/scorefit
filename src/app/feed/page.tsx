import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getFeed } from "@/db/social";
import { featureEnabledFor } from "@/lib/flags";
import { describeFeedItem } from "@/lib/feedText";
import { KudosButton } from "@/components/social/KudosButton";
import { ReportDialog } from "@/components/social/ReportDialog";
import { FeedLoadMore } from "@/components/social/FeedLoadMore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Feed",
  alternates: { canonical: "/feed" },
  robots: { index: false, follow: false },
};

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/feed");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  // Gated: SOCIAL_ENABLED globally, or the per-user allowlist (staged rollout).
  if (!featureEnabledFor("social", user.featureAllowlist)) notFound();

  const items = await getFeed(session.user.id, 30);
  const last = items[items.length - 1];
  const nextCursor = items.length === 30 && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="eyebrow">Feed</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">From people you follow</h1>
      <p className="mt-1.5 text-sm text-muted">
        Personal bests, achievements and milestones — never weight rankings. Give kudos to cheer them on.
      </p>
      <div className="mt-2 flex gap-3 text-xs">
        <Link href="/groups" className="text-data hover:underline">Groups →</Link>
        <Link href="/leaderboards" className="text-data hover:underline">Leaderboards →</Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-surface px-5 py-10 text-center text-sm text-muted">
          Nothing here yet. Follow some lifters and their milestones will show up.{" "}
          <Link href="/leaderboards" className="text-accent hover:underline">Find people →</Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-fg">
                  <Link href={`/users/${item.userId}`} className="font-semibold hover:underline">
                    {item.authorName}
                  </Link>{" "}
                  {describeFeedItem(item)}
                </p>
                <KudosButton eventId={item.id} initialCount={item.kudos} initialMine={item.youKudosed} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <time className="num block text-[11px] text-faint" dateTime={item.occurredOn}>
                  {item.occurredOn}
                </time>
                <ReportDialog targetType="activity_event" targetId={item.id} reportedUserId={item.userId} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && <FeedLoadMore initialCursor={nextCursor} />}
    </div>
  );
}
