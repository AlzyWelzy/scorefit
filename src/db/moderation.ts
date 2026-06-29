import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports, users, adminAuditLog, type Report } from "@/db/schema";

export type ReportTargetType = Report["targetType"];
export type ReportReason = Report["reason"];
export type ReportStatus = Report["status"];

/** True if the user is a full admin (can delete/grant). Read fresh (privileged surface). */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isAdmin: users.isAdmin, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row && (row.isAdmin || row.role === "admin");
}

/** True if the user can MODERATE (review reports/users) — admins and moderators. */
export async function isUserModerator(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isAdmin: users.isAdmin, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row && (row.isAdmin || row.role === "admin" || row.role === "moderator");
}

/** File a moderation report. Returns the new report id. */
export async function createReport(input: {
  reporterId: string;
  reportedUserId?: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(reports)
    .values({
      reporterId: input.reporterId,
      reportedUserId: input.reportedUserId ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      detail: input.detail ?? null,
    })
    .returning({ id: reports.id });
  return row!.id;
}

export type ReportRow = {
  id: string;
  reporterName: string | null;
  reportedUserId: string | null;
  reportedName: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  createdAt: Date;
};

/** The admin queue, newest first. Filter by status; defaults to open reports. */
export async function listReports(status: ReportStatus | "all" = "open", limit = 100): Promise<ReportRow[]> {
  const reporter = users;
  const rows = await db
    .select({
      id: reports.id,
      reporterName: reporter.displayName,
      reporterEmail: reporter.email,
      reportedUserId: reports.reportedUserId,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      detail: reports.detail,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(reporter, eq(reports.reporterId, reporter.id))
    .where(status === "all" ? sql`true` : eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(limit);

  // Resolve the reported user's display name separately (reportedUserId is nullable
  // and may point at a since-deleted account; keep this tolerant rather than joining).
  const reportedIds = [...new Set(rows.map((r) => r.reportedUserId).filter((x): x is string => !!x))];
  const nameById = new Map<string, string | null>();
  if (reportedIds.length) {
    const named = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(sql`${users.id} = any(${reportedIds})`);
    for (const n of named) nameById.set(n.id, n.displayName);
  }

  return rows.map((r) => ({
    id: r.id,
    reporterName: r.reporterName ?? r.reporterEmail,
    reportedUserId: r.reportedUserId,
    reportedName: r.reportedUserId ? (nameById.get(r.reportedUserId) ?? null) : null,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    detail: r.detail,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

/** Count of still-open reports, for the queue badge. */
export async function openReportCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reports)
    .where(eq(reports.status, "open"));
  return row?.n ?? 0;
}

/** The report's target (for content-hiding on "action"). Null if it no longer exists. */
export async function getReportById(
  reportId: string,
): Promise<{ targetType: ReportTargetType; targetId: string; reportedUserId: string | null } | null> {
  const [row] = await db
    .select({
      targetType: reports.targetType,
      targetId: reports.targetId,
      reportedUserId: reports.reportedUserId,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  return row ?? null;
}

// ─── User administration ───────────────────────────────────────────────────────

/** Grant or revoke full admin (keeps the role enum in sync). */
export async function setAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await db.update(users).set({ isAdmin, role: isAdmin ? "admin" : "user" }).where(eq(users.id, userId));
}

/** Set a user's privilege role (keeps the legacy isAdmin boolean in sync). */
export async function setRole(userId: string, role: "user" | "moderator" | "admin"): Promise<void> {
  await db.update(users).set({ role, isAdmin: role === "admin" }).where(eq(users.id, userId));
}

// ─── Admin audit log ───────────────────────────────────────────────────────────

/** Record a privileged admin action (append-only). Best-effort; never throws upward. */
export async function logAdminAction(entry: {
  adminId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      detail: entry.detail ?? null,
    });
  } catch {
    // Auditing must never block the action it records.
  }
}

export type AuditRow = {
  id: string;
  adminName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: Date;
};

/** Recent admin actions, newest first. */
export async function listAuditLog(limit = 100): Promise<AuditRow[]> {
  const rows = await db
    .select({
      id: adminAuditLog.id,
      adminName: users.displayName,
      adminEmail: users.email,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      detail: adminAuditLog.detail,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminId, users.id))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    adminName: r.adminName ?? r.adminEmail ?? null,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    detail: r.detail,
    createdAt: r.createdAt,
  }));
}

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  role: "user" | "moderator" | "admin";
  suspended: boolean;
  gamificationOptOut: boolean;
  createdAt: Date;
};

/** Search users by email or display name (case-insensitive substring), newest first. */
export async function searchUsers(query: string, limit = 25): Promise<AdminUserRow[]> {
  const q = `%${query.trim().toLowerCase()}%`;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
      role: users.role,
      suspendedSocialAt: users.suspendedSocialAt,
      gamificationOptOut: users.gamificationOptOut,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(sql`lower(${users.email}) like ${q} or lower(coalesce(${users.displayName}, '')) like ${q}`)
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    isAdmin: r.isAdmin,
    role: r.role,
    suspended: !!r.suspendedSocialAt,
    gamificationOptOut: r.gamificationOptOut,
    createdAt: r.createdAt,
  }));
}

/** Resolve a report (action or dismiss), stamping who/when. No-op if already resolved. */
export async function resolveReport(
  reportId: string,
  adminId: string,
  outcome: "actioned" | "dismissed",
): Promise<void> {
  await db
    .update(reports)
    .set({ status: outcome, resolvedByAdminId: adminId, resolvedAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")));
}

/**
 * Suspend (or lift) a user's PUBLIC/social privileges only — never the training
 * account. Suspending also clears their leaderboard opt-in so they drop off the
 * boards immediately. Lifting does not silently re-join boards (stays opt-in).
 */
export async function setSocialSuspension(userId: string, suspended: boolean): Promise<void> {
  const set: Partial<typeof users.$inferInsert> = {
    suspendedSocialAt: suspended ? new Date() : null,
  };
  if (suspended) set.leaderboardOptIn = false;
  await db.update(users).set(set).where(eq(users.id, userId));
}

// ─── Report grouping & bulk resolution ──────────────────────────────────────────

export type ReportGroup = {
  targetType: ReportTargetType;
  targetId: string;
  reportedUserId: string | null;
  count: number;
  reasons: string[];
  latestAt: Date;
};

/** Open reports grouped by their target, most-reported first — surfaces coordinated abuse
 *  that the flat per-report queue hides. */
export async function groupOpenReports(limit = 50): Promise<ReportGroup[]> {
  const rows = await db
    .select({
      targetType: reports.targetType,
      targetId: reports.targetId,
      reportedUserId: sql<string | null>`max(${reports.reportedUserId}::text)`,
      count: sql<number>`count(*)::int`,
      reasons: sql<string[]>`array_agg(distinct ${reports.reason})`,
      latestAt: sql<Date>`max(${reports.createdAt})`,
    })
    .from(reports)
    .where(eq(reports.status, "open"))
    .groupBy(reports.targetType, reports.targetId)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({
    targetType: r.targetType as ReportTargetType,
    targetId: r.targetId,
    reportedUserId: r.reportedUserId,
    count: r.count,
    reasons: r.reasons,
    latestAt: r.latestAt,
  }));
}

/** Resolve every open report against one target in a single action. Returns the count. */
export async function resolveReportsForTarget(
  targetType: ReportTargetType,
  targetId: string,
  adminId: string,
  outcome: "actioned" | "dismissed",
): Promise<number> {
  const rows = await db
    .update(reports)
    .set({ status: outcome, resolvedByAdminId: adminId, resolvedAt: new Date() })
    .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, "open")))
    .returning({ id: reports.id });
  return rows.length;
}
