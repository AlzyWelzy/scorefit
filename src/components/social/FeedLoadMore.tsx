"use client";

import { useState } from "react";
import Link from "next/link";
import { KudosButton } from "@/components/social/KudosButton";
import { ReportDialog } from "@/components/social/ReportDialog";

type Item = {
  id: string;
  userId: string;
  authorName: string;
  text: string;
  occurredOn: string;
  kudos: number;
  youKudosed: boolean;
};

type Cursor = { createdAt: string; id: string };

// Appends subsequent feed pages below the SSR'd first page via keyset pagination.
export function FeedLoadMore({ initialCursor }: { initialCursor: Cursor | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(initialCursor);
  const [busy, setBusy] = useState(false);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/feed?cursorAt=${encodeURIComponent(cursor.createdAt)}&cursorId=${encodeURIComponent(cursor.id)}`,
      );
      const d = (await res.json().catch(() => ({ items: [], nextCursor: null }))) as {
        items: Item[];
        nextCursor: Cursor | null;
      };
      setItems((prev) => [...prev, ...(d.items ?? [])]);
      setCursor(d.nextCursor ?? null);
    } catch {
      /* leave the button to retry */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {items.length > 0 && (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-fg">
                  <Link href={`/users/${item.userId}`} className="font-semibold hover:underline">
                    {item.authorName}
                  </Link>{" "}
                  {item.text}
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
      {cursor && (
        <button onClick={more} disabled={busy} className="btn-surface mt-4 w-full py-2 text-sm disabled:opacity-60">
          {busy ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
