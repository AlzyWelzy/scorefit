import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getConsistencyBoard, getPrCountBoard, type LeaderRow } from "@/db/leaderboard";
import { resolveLocalDate } from "@/lib/time";
import { featureEnabledFor, MIN_AGE, meetsMinAge } from "@/lib/flags";
import { LeaderboardOptIn } from "@/components/LeaderboardOptIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboards",
  alternates: { canonical: "/leaderboards" },
  robots: { index: false, follow: false },
};

export default async function LeaderboardsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leaderboards");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  // Gated: on for everyone once LEADERBOARDS_ENABLED is set (after the safety/legal
  // review), OR ahead of that for users on the per-user allowlist (staged rollout).
  if (!featureEnabledFor("leaderboards", user.featureAllowlist)) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <span className="eyebrow">Leaderboards</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Where you stand</h1>
      <p className="mt-2 text-sm text-muted">
        Self-relative boards — consistency and personal records. Heavier weight never wins.
      </p>

      {user.gamificationOptOut ? (
        <p className="mt-8 rounded-card border border-line bg-surface px-5 py-8 text-center text-sm text-muted">
          Leaderboards need gamification, which you&apos;ve turned off. Re-enable it in{" "}
          <a href="/account" className="text-accent hover:underline">
            account settings
          </a>{" "}
          to join.
        </p>
      ) : user.birthYear && !meetsMinAge(user.birthYear) ? (
        <p className="mt-8 rounded-card border border-line bg-surface px-5 py-8 text-center text-sm text-muted">
          Leaderboards are only available to members aged {MIN_AGE} and over. Your
          training logs and progress are unaffected.
        </p>
      ) : !user.leaderboardOptIn ? (
        <LeaderboardOptIn />
      ) : (
        <Boards viewerId={user.id} timezone={session.user.timezone} />
      )}
    </div>
  );
}

async function Boards({ viewerId, timezone }: { viewerId: string; timezone: string }) {
  const today = resolveLocalDate(timezone);
  const [consistency, prCount] = await Promise.all([
    getConsistencyBoard(viewerId, today),
    getPrCountBoard(viewerId),
  ]);
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
      <Board title="Consistency" hint="rolling 4-week %" rows={consistency} suffix="%" />
      <Board title="Personal records" hint="honest PRs set" rows={prCount} />
    </div>
  );
}

function Board({ title, hint, rows, suffix = "" }: { title: string; hint: string; rows: LeaderRow[]; suffix?: string }) {
  return (
    <div>
      <h2 className="eyebrow mb-2">
        {title} <span className="text-faint">· {hint}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
          This board unlocks once a few more lifters opt in. Keep training.
        </p>
      ) : (
        <div className="overflow-hidden rounded-card border border-line">
          <table className="w-full table-fixed">
            <caption className="sr-only">
              {title} leaderboard — {hint}, ranked from highest to lowest
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Lifter</th>
                <th scope="col">{title}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.rank}
                  className={`border-b border-line last:border-0 ${r.isYou ? "bg-accent/10" : ""}`}
                >
                  <td className="num w-6 py-2.5 pl-4 text-right align-middle text-xs text-faint">
                    {r.rank}
                  </td>
                  <td
                    className={`px-3 py-2.5 align-middle text-sm ${r.isYou ? "font-medium text-fg" : "text-muted"}`}
                  >
                    {r.name}
                    {r.isYou && <span className="ml-1.5 text-[11px] text-accent">you</span>}
                  </td>
                  <td className="num py-2.5 pr-4 text-right align-middle text-xs text-data">
                    {r.value}
                    {suffix}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
