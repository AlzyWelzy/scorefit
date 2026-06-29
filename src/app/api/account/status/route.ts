import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { openReportCount } from "@/db/moderation";
import { unreadNotificationCount } from "@/db/inbox";
import { featureEnabledFor } from "@/lib/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight, always-truthful account status read straight from the DB —
// used by the client (e.g. the verify banner) so the UI never depends on a
// possibly-stale session JWT. Returns 200 with authenticated:false when there
// is no session, so callers don't need to special-case 401.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    {
      authenticated: true,
      verified: !!user.emailVerified,
      unit: user.unit,
      twoFactorEnabled: user.twoFactorEnabled,
      // "Where you are" — lets the client TodayCard deep-link to the current week.
      currentProgram: user.currentProgram,
      currentWeek: user.currentWeek,
      // Drives which nav links the client shows: gamified surfaces + flag-gated pages.
      gamificationOptOut: user.gamificationOptOut,
      isAdmin: user.isAdmin || user.role === "admin",
      isModerator: user.isAdmin || user.role === "admin" || user.role === "moderator",
      // Open-report count for the moderation nav badge (0 for non-moderators — no leak).
      openReports:
        user.isAdmin || user.role === "admin" || user.role === "moderator" ? await openReportCount() : 0,
      unreadNotifications: await unreadNotificationCount(user.id),
      features: {
        leaderboards: featureEnabledFor("leaderboards", user.featureAllowlist),
        social: featureEnabledFor("social", user.featureAllowlist),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
