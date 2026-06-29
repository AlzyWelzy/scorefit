import "server-only";
import { and, asc, desc, eq, inArray, isNull, not, sql } from "drizzle-orm";
import { db } from "@/db";
import { follows, blocks, activityEvents, reactions, eventComments, users, userGameProfile, type ActivityEvent } from "@/db/schema";
import { createNotification } from "@/db/inbox";

export type ActivityKind = ActivityEvent["kind"];

// ─── Follow graph ────────────────────────────────────────────────────────────

/** Follow a user. No-op on self or if a block exists in either direction. */
export async function follow(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) return;
  if (await eitherBlocks(followerId, followeeId)) return;
  const inserted = await db
    .insert(follows)
    .values({ followerId, followeeId })
    .onConflictDoNothing()
    .returning({ followerId: follows.followerId });
  if (inserted.length) await createNotification(followeeId, "new_follower", followerId);
}

export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const [row] = await db
    .select({ x: sql<number>`1` })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);
  return !!row;
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

export async function block(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) return;
  await db.transaction(async (tx) => {
    await tx.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
    // A block tears down any follow in either direction.
    await tx
      .delete(follows)
      .where(
        sql`(${follows.followerId} = ${blockerId} and ${follows.followeeId} = ${blockedId})
          or (${follows.followerId} = ${blockedId} and ${follows.followeeId} = ${blockerId})`,
      );
  });
}

export async function unblock(blockerId: string, blockedId: string): Promise<void> {
  await db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
}

/** True if either user blocks the other (blocks override everything). */
export async function eitherBlocks(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ x: sql<number>`1` })
    .from(blocks)
    .where(
      sql`(${blocks.blockerId} = ${a} and ${blocks.blockedId} = ${b})
        or (${blocks.blockerId} = ${b} and ${blocks.blockedId} = ${a})`,
    )
    .limit(1);
  return !!row;
}

// ─── Activity events (emitted from the game engine / cron) ─────────────────────

/**
 * Emit a system activity event (idempotent per user+kind+day). Called best-effort from
 * the write path — never throws into the caller's transaction.
 */
export async function emitActivityEvent(
  userId: string,
  kind: ActivityKind,
  occurredOn: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await db
    .insert(activityEvents)
    .values({ userId, kind, occurredOn, data })
    .onConflictDoNothing(); // uq_activity(userId, kind, occurredOn)
}

// ─── Feed ──────────────────────────────────────────────────────────────────────

export type FeedItem = {
  id: string;
  userId: string;
  authorName: string;
  kind: ActivityKind;
  data: Record<string, unknown> | null;
  occurredOn: string;
  createdAt: Date;
  kudos: number;
  youKudosed: boolean;
};

const displayName = (name: string | null, id: string) => name?.trim() || `Lifter#${id.slice(0, 4)}`;

/**
 * The viewer's feed: recent events from people they follow (mutual not required), minus
 * anyone blocked in either direction. Includes kudos counts and whether the viewer
 * kudosed each. Newest first.
 */
export async function getFeed(viewerId: string, limit = 50): Promise<FeedItem[]> {
  const followees = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, viewerId));
  const ids = followees.map((f) => f.id);
  if (ids.length === 0) return [];

  // Exclude anyone the viewer blocks or who blocks the viewer.
  const blocked = await db
    .select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
    .from(blocks)
    .where(sql`${blocks.blockerId} = ${viewerId} or ${blocks.blockedId} = ${viewerId}`);
  const hidden = new Set<string>();
  for (const b of blocked) hidden.add(b.blocker === viewerId ? b.blocked : b.blocker);
  let visible = ids.filter((id) => !hidden.has(id));
  if (visible.length === 0) return [];

  // Privacy: an author's events appear only if NOT sharing-paused AND their visibility
  // admits this viewer — public = any follower (all `visible` here follow them);
  // friends = mutual follow only; private = nobody. Evaluated at read (re-checked every
  // load) so going private/paused retroactively narrows the footprint.
  const settings = await db
    .select({ id: users.id, vis: users.profileVisibility, paused: users.sharingPaused })
    .from(users)
    .where(inArray(users.id, visible));
  const mutuals = new Set(await mutualFollowIds(viewerId));
  const allowedAuthor = new Map(settings.map((s) => [s.id, s]));
  visible = visible.filter((id) => {
    const s = allowedAuthor.get(id);
    if (!s || s.paused) return false;
    if (s.vis === "private") return false;
    if (s.vis === "friends") return mutuals.has(id);
    return true; // public
  });
  if (visible.length === 0) return [];

  const rows = await db
    .select({
      id: activityEvents.id,
      userId: activityEvents.userId,
      authorName: users.displayName,
      kind: activityEvents.kind,
      data: activityEvents.data,
      occurredOn: activityEvents.occurredOn,
      createdAt: activityEvents.createdAt,
      kudos: sql<number>`(select count(*)::int from ${reactions} r where r.event_id = ${activityEvents.id})`,
      youKudosed: sql<boolean>`exists (select 1 from ${reactions} r where r.event_id = ${activityEvents.id} and r.user_id = ${viewerId})`,
    })
    .from(activityEvents)
    .innerJoin(users, eq(activityEvents.userId, users.id))
    .where(and(inArray(activityEvents.userId, visible), isNull(activityEvents.hiddenAt)))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    authorName: displayName(r.authorName, r.userId),
    kind: r.kind,
    data: r.data,
    occurredOn: r.occurredOn,
    createdAt: r.createdAt,
    kudos: r.kudos,
    youKudosed: r.youKudosed,
  }));
}

// ─── Kudos ───────────────────────────────────────────────────────────────────

/** Toggle a kudos on an event. Returns the new state. Blocked authors can't be kudosed. */
export async function toggleKudos(userId: string, eventId: string): Promise<{ kudosed: boolean }> {
  const [ev] = await db
    .select({ authorId: activityEvents.userId })
    .from(activityEvents)
    .where(eq(activityEvents.id, eventId))
    .limit(1);
  if (!ev) return { kudosed: false };
  if (await eitherBlocks(userId, ev.authorId)) return { kudosed: false };

  const [existing] = await db
    .select({ x: sql<number>`1` })
    .from(reactions)
    .where(and(eq(reactions.eventId, eventId), eq(reactions.userId, userId)))
    .limit(1);
  if (existing) {
    await db.delete(reactions).where(and(eq(reactions.eventId, eventId), eq(reactions.userId, userId)));
    return { kudosed: false };
  }
  await db.insert(reactions).values({ eventId, userId }).onConflictDoNothing();
  await createNotification(ev.authorId, "kudos", userId, { eventId });
  return { kudosed: true };
}

// ─── Comments ────────────────────────────────────────────────────────────────

/** Add a comment to an event (≤280 chars enforced by caller). Blocked authors barred. */
export async function addComment(userId: string, eventId: string, body: string): Promise<string | null> {
  const [ev] = await db
    .select({ authorId: activityEvents.userId })
    .from(activityEvents)
    .where(eq(activityEvents.id, eventId))
    .limit(1);
  if (!ev) return null;
  if (await eitherBlocks(userId, ev.authorId)) return null;
  const [row] = await db
    .insert(eventComments)
    .values({ eventId, authorId: userId, body })
    .returning({ id: eventComments.id });
  return row?.id ?? null;
}

export type CommentRow = { id: string; authorName: string; body: string; createdAt: Date };

/** Visible (non-hidden) comments for an event, oldest first. */
export async function getComments(eventId: string): Promise<CommentRow[]> {
  const rows = await db
    .select({
      id: eventComments.id,
      authorId: eventComments.authorId,
      authorName: users.displayName,
      body: eventComments.body,
      createdAt: eventComments.createdAt,
    })
    .from(eventComments)
    .innerJoin(users, eq(eventComments.authorId, users.id))
    .where(and(eq(eventComments.eventId, eventId), isNull(eventComments.hiddenAt)))
    .orderBy(asc(eventComments.createdAt));
  return rows.map((r) => ({ id: r.id, authorName: displayName(r.authorName, r.authorId), body: r.body, createdAt: r.createdAt }));
}

/** Soft-delete a comment (moderation / author). */
export async function hideComment(commentId: string): Promise<void> {
  await db.update(eventComments).set({ hiddenAt: new Date() }).where(eq(eventComments.id, commentId));
}

/** Soft-delete an activity event (moderation). Hidden events drop out of all feeds. */
export async function hideActivityEvent(eventId: string): Promise<void> {
  await db.update(activityEvents).set({ hiddenAt: new Date() }).where(eq(activityEvents.id, eventId));
}

/** Mutual follows = "friends" (derived). Used for friend-scoped surfaces later. */
export async function mutualFollowIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, userId),
        sql`exists (select 1 from ${follows} f2 where f2.follower_id = ${follows.followeeId} and f2.followee_id = ${userId})`,
        not(sql`exists (select 1 from ${blocks} b where (b.blocker_id = ${userId} and b.blocked_id = ${follows.followeeId}) or (b.blocker_id = ${follows.followeeId} and b.blocked_id = ${userId}))`),
      ),
    );
  return rows.map((r) => r.id);
}

// ─── Public profile ──────────────────────────────────────────────────────────

export type PublicProfile = {
  userId: string;
  name: string;
  level: number;
  title: string;
  joinedAt: Date;
  isSelf: boolean;
  isFollowing: boolean;
};

/**
 * A user's public profile AS SEEN BY the viewer, or null if they can't see it. Visibility
 * is enforced here, not the caller: blocks hard-override; suspended accounts are hidden;
 * 'private' is self-only; 'friends' requires a mutual follow; 'public' is anyone signed in.
 */
export async function getPublicProfile(viewerId: string, targetId: string): Promise<PublicProfile | null> {
  if (await eitherBlocks(viewerId, targetId)) return null;

  const [u] = await db
    .select({
      name: users.displayName,
      createdAt: users.createdAt,
      visibility: users.profileVisibility,
      suspended: users.suspendedSocialAt,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!u) return null;

  const isSelf = viewerId === targetId;
  if (!isSelf) {
    if (u.suspended) return null;
    if (u.visibility === "private") return null;
    if (u.visibility === "friends") {
      const mutuals = new Set(await mutualFollowIds(viewerId));
      if (!mutuals.has(targetId)) return null;
    }
  }

  const [gp] = await db
    .select({ level: userGameProfile.level, title: userGameProfile.title })
    .from(userGameProfile)
    .where(eq(userGameProfile.userId, targetId))
    .limit(1);

  return {
    userId: targetId,
    name: displayName(u.name, targetId),
    level: gp?.level ?? 1,
    title: gp?.title ?? "Novice",
    joinedAt: u.createdAt,
    isSelf,
    isFollowing: isSelf ? false : await isFollowing(viewerId, targetId),
  };
}
