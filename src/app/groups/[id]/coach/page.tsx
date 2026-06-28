import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getGroup, getCoachDashboard } from "@/db/groups";
import { featureEnabledFor } from "@/lib/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Coach dashboard",
  robots: { index: false, follow: false },
};

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/groups");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");
  if (!featureEnabledFor("social", user.featureAllowlist)) notFound();

  const { id } = await params;
  const [group, res] = await Promise.all([getGroup(id), getCoachDashboard(id, session.user.id)]);
  if (!group || "error" in res) notFound();

  // A member is "visible" (summary computed) exactly when they consented and aren't
  // paused/blocked — getCoachDashboard returns a streak number for those, null otherwise.
  const sharing = res.members.filter((m) => m.currentStreak !== null);
  const notSharing = res.members.filter((m) => m.currentStreak === null);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href={`/groups/${group.id}`} className="text-xs text-muted hover:text-fg">
        ← {group.name}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Coach dashboard</h1>
      <p className="mt-1.5 text-sm text-muted">
        Training summaries for members who have opted in to share with this group&apos;s coaches. Consent is
        theirs to give and revoke at any time.
      </p>

      {sharing.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-surface px-5 py-10 text-center text-sm text-muted">
          No members are sharing their training yet.
        </p>
      ) : (
        <div className="card mt-6 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Member training summaries</caption>
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                <th scope="col" className="px-4 py-2 font-medium">Member</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Streak</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Consistency</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Level</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Last trained</th>
              </tr>
            </thead>
            <tbody>
              {sharing.map((m) => (
                <tr key={m.userId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-fg">{m.name}</td>
                  <td className="num px-3 py-2.5 text-right text-muted">{m.currentStreak}w</td>
                  <td className="num px-3 py-2.5 text-right text-muted">{m.rollingConsistency}%</td>
                  <td className="num px-3 py-2.5 text-right text-muted">
                    {m.level != null ? (
                      <>
                        {m.level}
                        {m.title ? <span className="text-faint"> · {m.title}</span> : null}
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-muted">{m.lastTrained ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notSharing.length > 0 && (
        <p className="mt-4 text-xs text-faint">
          {notSharing.length} member{notSharing.length === 1 ? "" : "s"} not sharing training:{" "}
          {notSharing.map((m) => m.name).join(", ")}
        </p>
      )}
    </div>
  );
}
