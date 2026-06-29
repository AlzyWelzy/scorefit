import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isUserModerator } from "@/db/moderation";
import { getAdminMetrics } from "@/db/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Metrics",
  alternates: { canonical: "/admin/metrics" },
  robots: { index: false, follow: false },
};

export default async function AdminMetricsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/metrics");
  if (!(await isUserModerator(session.user.id))) notFound();

  const m = await getAdminMetrics();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/admin" className="text-xs text-muted hover:text-fg">
        ← Report queue
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Metrics</h1>
      <p className="mt-1.5 text-sm text-muted">Product &amp; health snapshot, live from the database.</p>

      <section className="mt-6">
        <h2 className="eyebrow mb-2">Users</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="total" value={m.totalUsers} />
          <Stat label="verified" value={m.verifiedUsers} />
          <Stat label="signups · 7d" value={m.signups7d} />
          <Stat label="signups · 30d" value={m.signups30d} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="eyebrow mb-2">Activity</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="active users · 7d" value={m.activeUsers7d} />
          <Stat label="sessions · 7d" value={m.sessions7d} />
          <Stat label="sessions · 30d" value={m.sessions30d} />
          <Stat label="leaderboard opt-ins" value={m.leaderboardOptIns} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="eyebrow mb-2">Moderation &amp; flags</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="open reports" value={m.openReports} accent={m.openReports > 0} />
          <Stat label="social-suspended" value={m.suspended} />
          <Stat label="gamification off" value={m.gamificationOptOuts} />
          <Stat label="admins" value={m.admins} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <div className={`num text-2xl font-bold ${accent ? "text-hard" : "text-data"}`}>{value.toLocaleString()}</div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}
