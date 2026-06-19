import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getFeed, type FeedItem } from "@/db/social";
import { getExercise } from "@/lib/data";
import { featureEnabledFor } from "@/lib/flags";
import { KudosButton } from "@/components/social/KudosButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Feed",
  alternates: { canonical: "/feed" },
  robots: { index: false, follow: false },
};

// Human-readable, system-generated line per event kind (never free text).
function describe(item: FeedItem): string {
  const d = item.data ?? {};
  switch (item.kind) {
    case "e1rm_pr": {
      const name = getExercise(String(d.exerciseSlug))?.name ?? String(d.exerciseSlug ?? "a lift");
      return `hit a new best on ${name} — e1RM ${d.e1rm ?? "?"}`;
    }
    case "achievement":
      return `unlocked “${d.title ?? "an achievement"}”`;
    case "streak_milestone":
      return `reached a ${d.weeks ?? ""}-week streak`;
    case "program_completed":
      return `completed a training block`;
    case "session_completed":
      return `trained`;
    default:
      return "did something";
  }
}

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/feed");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  // Gated: SOCIAL_ENABLED globally, or the per-user allowlist (staged rollout).
  if (!featureEnabledFor("social", user.featureAllowlist)) notFound();

  const items = await getFeed(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="eyebrow">Feed</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">From people you follow</h1>
      <p className="mt-1.5 text-sm text-muted">
        Personal bests, achievements and milestones — never weight rankings. Give kudos to cheer them on.
      </p>

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
                  <span className="font-semibold">{item.authorName}</span> {describe(item)}
                </p>
                <KudosButton eventId={item.id} initialCount={item.kudos} initialMine={item.youKudosed} />
              </div>
              <time className="num mt-1 block text-[11px] text-faint" dateTime={item.occurredOn}>
                {item.occurredOn}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
