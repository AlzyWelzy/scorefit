import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isUserModerator, listAuditLog } from "@/db/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Audit log",
  alternates: { canonical: "/admin/audit" },
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/audit");
  if (!(await isUserModerator(session.user.id))) notFound();

  const entries = await listAuditLog(200);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/admin" className="text-xs text-muted hover:text-fg">
        ← Report queue
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Audit log</h1>
      <p className="mt-1.5 text-sm text-muted">
        Append-only record of privileged admin actions — the {entries.length} most recent.
      </p>

      {entries.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-10 text-center text-sm text-muted">
          No admin actions recorded yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-1.5">
          {entries.map((e) => (
            <li key={e.id} className="card flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="text-sm text-fg">
                <span className="num text-accent">{e.action}</span>
                {e.targetType && (
                  <span className="text-muted">
                    {" "}
                    · {e.targetType}
                    {e.targetId ? <span className="num text-faint"> {e.targetId.slice(0, 8)}</span> : null}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-faint">
                by {e.adminName ?? "—"} ·{" "}
                <time dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleString()}</time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
