import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isUserAdmin, listReports } from "@/db/moderation";
import { ReportQueue } from "@/components/admin/ReportQueue";

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

  const open = await listReports("open");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <span className="eyebrow">Moderation</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Report queue</h1>
      <p className="mt-1.5 text-sm text-muted">
        {open.length} open {open.length === 1 ? "report" : "reports"}. Actioning a user
        suspends their public/social privileges only — never their training account.
      </p>
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
