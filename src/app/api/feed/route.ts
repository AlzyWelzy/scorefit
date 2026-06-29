import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getFeed } from "@/db/social";
import { featureEnabledFor } from "@/lib/flags";
import { describeFeedItem } from "@/lib/feedText";

export const runtime = "nodejs";

const PAGE = 30;

// Keyset-paginated feed page for "load more". Pre-renders each line server-side so the
// client list stays dumb (no getExercise/describe logic shipped to the browser).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getUserById(session.user.id);
  if (!me || !featureEnabledFor("social", me.featureAllowlist)) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(req.url);
  const cursorAt = url.searchParams.get("cursorAt");
  const cursorId = url.searchParams.get("cursorId");
  const cursor = cursorAt && cursorId ? { createdAt: cursorAt, id: cursorId } : undefined;

  const items = await getFeed(session.user.id, PAGE, cursor);
  const mapped = items.map((i) => ({
    id: i.id,
    userId: i.userId,
    authorName: i.authorName,
    text: describeFeedItem(i),
    occurredOn: i.occurredOn,
    kudos: i.kudos,
    youKudosed: i.youKudosed,
  }));
  const last = items[items.length - 1];
  const nextCursor = items.length === PAGE && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null;

  return NextResponse.json({ items: mapped, nextCursor });
}
