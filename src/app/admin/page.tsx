import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isUserAdmin, listReports, groupOpenReports } from "@/db/moderation";
import { ReportQueue } from "@/components/admin/ReportQueue";
import { GroupedReports } from "@/components/admin/GroupedReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  alternates: { canonical: "/admin" },
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");

  // Non-admins get a 404, not a 403 — don't reveal the route exists.
  if (!(await isUserAdmin(session.user.id))) notFound();

  const [open, groups] = await Promise.all([listReports("open"), groupOpenReports()]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Moderation</span>
        <span className="flex items-center gap-4">
          <Link href="/admin/users" className="text-sm text-data hover:underline">
            Manage users →
          </Link>
          <Link href="/admin/audit" className="text-sm text-data hover:underline">
            Audit log →
          </Link>
          <Link href="/admin/metrics" className="text-sm text-data hover:underline">
            Metrics →
          </Link>
        </span>
      </div>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Report queue</h1>
      <p className="mt-1.5 text-sm text-muted">
        {open.length} open {open.length === 1 ? "report" : "reports"}. Actioning a report hides the
        reported content; the suspend option also removes the user&apos;s public/social privileges —
        never their training account.
      </p>

      {groups.length > 1 && (
        <GroupedReports groups={groups.map((g) => ({ ...g, latestAt: g.latestAt.toISOString() }))} />
      )}

      <h2 className="eyebrow mt-8 mb-2">All open reports</h2>
      <ReportQueue
        reports={open.map((r) => ({
          id: r.id,
          reporterName: r.reporterName,
          reportedUserId: r.reportedUserId,
          reportedName: r.reportedName,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          detail: r.detail,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
