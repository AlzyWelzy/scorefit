import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, groupMembers, users, workoutSessions, type Group } from "@/db/schema";
import { eitherBlocks } from "@/db/social";
import { getStreakSummary } from "@/db/streaks";
import { getGameProfile } from "@/db/game";
import { resolveLocalDate } from "@/lib/time";

export type GroupRole = "owner" | "coach" | "member";
export type GroupKind = "crew" | "coaching";

// Sane caps so a single account can't spam groups or balloon a roster (the limiter
// guards rate; these guard absolute size).
const MAX_OWNED_GROUPS = 20;
const MAX_GROUP_MEMBERS = 200;

const displayName = (name: string | null, id: string) => name?.trim() || `Lifter#${id.slice(0, 4)}`;

export type Result<T = { ok: true }> = T | { error: string };

// ─── Reads ───────────────────────────────────────────────────────────────────

export type GroupSummary = {
  id: string;
  name: string;
  kind: GroupKind;
  ownerId: string;
  role: GroupRole;
  memberCount: number;
};

/** Groups the user belongs to, with their role and the member count. Newest first. */
export async function getUserGroups(userId: string): Promise<GroupSummary[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      kind: groups.kind,
      ownerId: groups.ownerId,
      role: groupMembers.role,
      createdAt: groups.createdAt,
      memberCount: sql<number>`(select count(*)::int from ${groupMembers} gm where gm.group_id = ${groups.id})`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId))
    .orderBy(sql`${groups.createdAt} desc`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as GroupKind,
    ownerId: r.ownerId,
    role: r.role as GroupRole,
    memberCount: r.memberCount,
  }));
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const [row] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return row ?? null;
}

export type Membership = { role: GroupRole; sharesTrainingWithCoach: boolean };

export async function getMembership(groupId: string, userId: string): Promise<Membership | null> {
  const [row] = await db
    .select({ role: groupMembers.role, sharesTrainingWithCoach: groupMembers.sharesTrainingWithCoach })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row ? { role: row.role as GroupRole, sharesTrainingWithCoach: row.sharesTrainingWithCoach } : null;
}

export type GroupMemberView = {
  userId: string;
  name: string;
  role: GroupRole;
  sharesTrainingWithCoach: boolean;
  joinedAt: Date;
};

export async function getGroupMembers(groupId: string): Promise<GroupMemberView[]> {
  const rows = await db
    .select({
      userId: groupMembers.userId,
      name: users.displayName,
      role: groupMembers.role,
      shares: groupMembers.sharesTrainingWithCoach,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));
  return rows.map((r) => ({
    userId: r.userId,
    name: displayName(r.name, r.userId),
    role: r.role as GroupRole,
    sharesTrainingWithCoach: r.shares,
    joinedAt: r.joinedAt,
  }));
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createGroup(ownerId: string, name: string, kind: GroupKind): Promise<Result<{ id: string }>> {
  const [owned] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(groups)
    .where(eq(groups.ownerId, ownerId));
  if ((owned?.c ?? 0) >= MAX_OWNED_GROUPS) {
    return { error: "You've reached the maximum number of groups you can own." };
  }
  return db.transaction(async (tx) => {
    const [g] = await tx.insert(groups).values({ name, ownerId, kind }).returning({ id: groups.id });
    if (!g) return { error: "Could not create the group." };
    await tx.insert(groupMembers).values({ groupId: g.id, userId: ownerId, role: "owner" });
    return { id: g.id };
  });
}

export async function joinGroup(groupId: string, userId: string): Promise<Result> {
  const g = await getGroup(groupId);
  if (!g) return { error: "Group not found." };
  // Blocks override everything: don't let someone the owner blocked (or who blocked the
  // owner) into their group.
  if (await eitherBlocks(userId, g.ownerId)) return { error: "You can't join this group." };
  const [size] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  if ((size?.c ?? 0) >= MAX_GROUP_MEMBERS) return { error: "This group is full." };
  await db.insert(groupMembers).values({ groupId, userId, role: "member" }).onConflictDoNothing();
  return { ok: true };
}

export async function leaveGroup(groupId: string, userId: string): Promise<Result> {
  const g = await getGroup(groupId);
  if (!g) return { error: "Group not found." };
  if (g.ownerId === userId) return { error: "Owners can't leave — delete the group instead." };
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return { ok: true };
}

export async function deleteGroup(groupId: string, requesterId: string): Promise<Result> {
  const g = await getGroup(groupId);
  if (!g) return { error: "Group not found." };
  if (g.ownerId !== requesterId) return { error: "Only the owner can delete this group." };
  await db.delete(groups).where(eq(groups.id, groupId)); // cascades members
  return { ok: true };
}

/** A member sets/revokes whether coaches of the group may see their training. */
export async function setCoachConsent(groupId: string, userId: string, shares: boolean): Promise<Result> {
  const m = await getMembership(groupId, userId);
  if (!m) return { error: "You're not a member of this group." };
  await db
    .update(groupMembers)
    .set({ sharesTrainingWithCoach: shares })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return { ok: true };
}

export async function removeMember(groupId: string, requesterId: string, targetUserId: string): Promise<Result> {
  const g = await getGroup(groupId);
  if (!g) return { error: "Group not found." };
  if (g.ownerId !== requesterId) return { error: "Only the owner can remove members." };
  if (targetUserId === g.ownerId) return { error: "The owner can't be removed." };
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));
  return { ok: true };
}

export async function setMemberRole(
  groupId: string,
  requesterId: string,
  targetUserId: string,
  role: "coach" | "member",
): Promise<Result> {
  const g = await getGroup(groupId);
  if (!g) return { error: "Group not found." };
  if (g.ownerId !== requesterId) return { error: "Only the owner can change roles." };
  if (targetUserId === g.ownerId) return { error: "The owner's role can't be changed." };
  await db
    .update(groupMembers)
    .set({ role })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));
  return { ok: true };
}

// ─── Coach dashboard ───────────────────────────────────────────────────────────

export type CoachMember = {
  userId: string;
  name: string;
  consented: boolean;
  paused: boolean;
  /** training summary, present only when the member consents AND isn't paused/blocked */
  lastTrained: string | null;
  currentStreak: number | null;
  longestStreak: number | null;
  rollingConsistency: number | null;
  /** gamification fields — null when the member has gamification turned off */
  level: number | null;
  title: string | null;
};

/**
 * The coach view of a coaching group: each member's training summary, shown ONLY with the
 * member's explicit, revocable consent (sharesTrainingWithCoach) and never when they've
 * paused sharing or a block exists. Gamification fields are withheld for members who've
 * opted out of gamification (attendance/streak is still plain training data).
 */
export async function getCoachDashboard(groupId: string, viewerId: string): Promise<Result<{ members: CoachMember[] }>> {
  const g = await getGroup(groupId);
  if (!g) return { error: "Group not found." };
  if (g.kind !== "coaching") return { error: "This group has no coach view." };
  const viewer = await getMembership(groupId, viewerId);
  if (!viewer || (viewer.role !== "owner" && viewer.role !== "coach")) return { error: "Coach access only." };

  const rows = await db
    .select({
      userId: groupMembers.userId,
      name: users.displayName,
      timezone: users.timezone,
      shares: groupMembers.sharesTrainingWithCoach,
      paused: users.sharingPaused,
      optOut: users.gamificationOptOut,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  // Last-trained per member in one query.
  const ids = rows.map((r) => r.userId);
  const lastByUser = new Map<string, string>();
  if (ids.length) {
    const ls = await db
      .select({ userId: workoutSessions.userId, last: sql<string | null>`max(${workoutSessions.sessionDate})` })
      .from(workoutSessions)
      .where(inArray(workoutSessions.userId, ids))
      .groupBy(workoutSessions.userId);
    for (const r of ls) if (r.last) lastByUser.set(r.userId, r.last);
  }

  const members: CoachMember[] = [];
  for (const r of rows) {
    const blocked = await eitherBlocks(viewerId, r.userId);
    const visible = r.shares && !r.paused && !blocked;
    let currentStreak: number | null = null;
    let longestStreak: number | null = null;
    let rollingConsistency: number | null = null;
    let level: number | null = null;
    let title: string | null = null;
    if (visible) {
      const s = await getStreakSummary(r.userId, resolveLocalDate(r.timezone));
      currentStreak = s.currentStreak;
      longestStreak = s.longestStreak;
      rollingConsistency = s.rollingConsistency;
      if (!r.optOut) {
        const gp = await getGameProfile(r.userId);
        level = gp?.level ?? null;
        title = gp?.title ?? null;
      }
    }
    members.push({
      userId: r.userId,
      name: displayName(r.name, r.userId),
      consented: r.shares,
      paused: r.paused,
      lastTrained: visible ? lastByUser.get(r.userId) ?? null : null,
      currentStreak,
      longestStreak,
      rollingConsistency,
      level,
      title,
    });
  }
  // Consenting (visible) members first, then alphabetical.
  members.sort(
    (a, b) => Number(b.currentStreak !== null) - Number(a.currentStreak !== null) || a.name.localeCompare(b.name),
  );
  return { members };
}
