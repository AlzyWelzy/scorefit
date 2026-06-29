import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listNotifications, markAllNotificationsRead, type InboxItem } from "@/db/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications",
  alternates: { canonical: "/notifications" },
  robots: { index: false, follow: false },
};

function describe(item: InboxItem): string {
  const who = item.actorName ?? "Someone";
  switch (item.kind) {
    case "new_follower":
      return `${who} followed you`;
    case "kudos":
      return `${who} gave you kudos`;
    default:
      return "New activity";
  }
}

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/notifications");

  const items = await listNotifications(session.user.id);
  // Viewing the inbox marks everything read (clears the bell badge on next poll).
  await markAllNotificationsRead(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="eyebrow">Notifications</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Your activity</h1>

      {items.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-surface px-5 py-10 text-center text-sm text-muted">
          Nothing yet. Follows and kudos will show up here.
        </p>
      ) : (
        <ul className="mt-6 space-y-1.5">
          {items.map((item) => {
            const body = (
              <span className="flex items-center justify-between gap-3">
                <span className={`text-sm ${item.readAt ? "text-muted" : "text-fg"}`}>{describe(item)}</span>
                <time className="shrink-0 text-[11px] text-faint" dateTime={item.createdAt.toISOString()}>
                  {item.createdAt.toLocaleDateString()}
                </time>
              </span>
            );
            return (
              <li key={item.id} className="card px-4 py-2.5">
                {item.actorId ? (
                  <Link href={`/users/${item.actorId}`} className="block hover:opacity-80">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
