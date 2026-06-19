import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports, users, type Report } from "@/db/schema";

export type ReportTargetType = Report["targetType"];
export type ReportReason = Report["reason"];
export type ReportStatus = Report["status"];

/** True if the user exists and has the admin flag. Read fresh (privileged surface). */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row?.isAdmin;
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
