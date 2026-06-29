import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isUserAdmin, isUserModerator, searchUsers } from "@/db/moderation";
import { UserAdmin } from "@/components/admin/UserAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Users",
  alternates: { canonical: "/admin/users" },
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/users");
  // Non-moderators get a 404, not a 403 — don't reveal the route exists.
  if (!(await isUserModerator(session.user.id))) notFound();
  const viewerIsAdmin = await isUserAdmin(session.user.id);

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const users = query ? await searchUsers(query) : [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/admin" className="text-xs text-muted hover:text-fg">
        ← Report queue
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Users</h1>
      <p className="mt-1.5 text-sm text-muted">
        Suspending a user removes their public/social privileges only — never their training account.
      </p>

      <form action="/admin/users" method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by email or display name…"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </form>

      <UserAdmin
        selfId={session.user.id}
        viewerIsAdmin={viewerIsAdmin}
        searched={!!query}
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          isAdmin: u.isAdmin,
          role: u.role,
          suspended: u.suspended,
          gamificationOptOut: u.gamificationOptOut,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
