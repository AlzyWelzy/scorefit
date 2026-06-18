import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getConsistencyBoard, getPrCountBoard, type LeaderRow } from "@/db/leaderboard";
import { resolveLocalDate } from "@/lib/time";
import { FLAGS } from "@/lib/flags";
import { LeaderboardOptIn } from "@/components/LeaderboardOptIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboards",
  alternates: { canonical: "/leaderboards" },
  robots: { index: false, follow: false },
};

export default async function LeaderboardsPage() {
  // Gated: the feature must be explicitly enabled (after the safety/legal review).
  if (!FLAGS.leaderboards) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leaderboards");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

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
          No one&apos;s here yet. Keep training.
        </p>
      ) : (
        <div className="overflow-hidden rounded-card border border-line">
          {rows.map((r) => (
            <div
              key={r.rank}
              className={`flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0 ${r.isYou ? "bg-accent/10" : ""}`}
            >
              <span className="flex items-center gap-3">
                <span className="num w-6 text-right text-xs text-faint">{r.rank}</span>
                <span className={`text-sm ${r.isYou ? "font-medium text-fg" : "text-muted"}`}>
                  {r.name}
                  {r.isYou && <span className="ml-1.5 text-[11px] text-accent">you</span>}
                </span>
              </span>
              <span className="num text-xs text-data">
                {r.value}
                {suffix}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
