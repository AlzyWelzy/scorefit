import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";

export type NotificationKind = "new_follower" | "kudos";

const displayName = (name: string | null, id: string) => name?.trim() || `Lifter#${id.slice(0, 4)}`;

/** Create an in-app notification (best-effort, never throws into the caller). No self-notify. */
export async function createNotification(
  userId: string,
  kind: NotificationKind,
  actorId: string | null,
  data?: Record<string, unknown>,
): Promise<void> {
  if (actorId && actorId === userId) return;
  try {
    await db.insert(notifications).values({ userId, kind, actorId, data: data ?? null });
  } catch {
    // notifications are non-critical
  }
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export type InboxItem = {
  id: string;
  kind: string;
  actorId: string | null;
  actorName: string | null;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function listNotifications(userId: string, limit = 50): Promise<InboxItem[]> {
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      actorId: notifications.actorId,
      actorName: users.displayName,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    actorId: r.actorId,
    actorName: r.actorId ? displayName(r.actorName, r.actorId) : null,
    data: r.data,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
