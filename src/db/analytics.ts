import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workoutSessions } from "@/db/schema";
import { openReportCount } from "@/db/moderation";

export type AdminMetrics = {
  totalUsers: number;
  verifiedUsers: number;
  signups7d: number;
  signups30d: number;
  leaderboardOptIns: number;
  gamificationOptOuts: number;
  suspended: number;
  admins: number;
  sessions7d: number;
  sessions30d: number;
  activeUsers7d: number;
  openReports: number;
};

/** Aggregate product/health metrics for /admin/metrics — all computed in SQL. */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [u] = await db
    .select({
      totalUsers: sql<number>`count(*)::int`,
      verifiedUsers: sql<number>`count(*) filter (where ${users.emailVerified} is not null)::int`,
      signups7d: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')::int`,
      signups30d: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '30 days')::int`,
      leaderboardOptIns: sql<number>`count(*) filter (where ${users.leaderboardOptIn})::int`,
      gamificationOptOuts: sql<number>`count(*) filter (where ${users.gamificationOptOut})::int`,
      suspended: sql<number>`count(*) filter (where ${users.suspendedSocialAt} is not null)::int`,
      admins: sql<number>`count(*) filter (where ${users.isAdmin})::int`,
    })
    .from(users);

  const [s] = await db
    .select({
      sessions7d: sql<number>`count(*) filter (where ${workoutSessions.sessionDate} >= current_date - 7)::int`,
      sessions30d: sql<number>`count(*) filter (where ${workoutSessions.sessionDate} >= current_date - 30)::int`,
      activeUsers7d: sql<number>`count(distinct ${workoutSessions.userId}) filter (where ${workoutSessions.sessionDate} >= current_date - 7)::int`,
    })
    .from(workoutSessions);

  const openReports = await openReportCount();

  return {
    totalUsers: u?.totalUsers ?? 0,
    verifiedUsers: u?.verifiedUsers ?? 0,
    signups7d: u?.signups7d ?? 0,
    signups30d: u?.signups30d ?? 0,
    leaderboardOptIns: u?.leaderboardOptIns ?? 0,
    gamificationOptOuts: u?.gamificationOptOuts ?? 0,
    suspended: u?.suspended ?? 0,
    admins: u?.admins ?? 0,
    sessions7d: s?.sessions7d ?? 0,
    sessions30d: s?.sessions30d ?? 0,
    activeUsers7d: s?.activeUsers7d ?? 0,
    openReports,
  };
}
