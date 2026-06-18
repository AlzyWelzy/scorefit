import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getGameProfile, getXpBreakdown } from "@/db/game";
import { getUserById } from "@/db/users";
import { levelProgress } from "@/lib/game/levels";
import { GamificationOff } from "@/components/GamificationOff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  alternates: { canonical: "/profile" },
  robots: { index: false, follow: false },
};

const SOURCE_LABEL: Record<string, string> = {
  set_completion: "Completed sets",
  log_quality: "Honest logging",
  pr: "Personal records",
  achievement: "Achievements",
  cadence: "Weekly cadence",
  perfect_week: "Perfect weeks",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile");

  const [user, profile, breakdown] = await Promise.all([
    getUserById(session.user.id),
    getGameProfile(session.user.id),
    getXpBreakdown(session.user.id),
  ]);

  if (user?.gamificationOptOut) return <GamificationOff title="Training Score" />;

  const totalXp = profile?.totalXp ?? 0;
  const prog = levelProgress(totalXp);
  const pct = prog.levelSpan > 0 ? Math.round((prog.intoLevel / prog.levelSpan) * 100) : 0;
  const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <span className="eyebrow">Training Score</span>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Level {prog.level} · <span className="text-accent">{prog.title}</span>
        </h1>
        <Link href="/achievements" className="text-sm text-data hover:underline">
          Trophy room →
        </Link>
      </div>

      <div className="mt-6 rounded-card border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <span className="num text-2xl font-bold text-fg">{totalXp.toLocaleString()} XP</span>
          <span className="num text-xs text-muted">
            {prog.toNext.toLocaleString()} to level {prog.level + 1}
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.max(pct, totalXp > 0 ? 4 : 0)}%` }}
          />
        </div>
      </div>

      {breakdownEntries.length === 0 ? (
        <p className="mt-10 rounded-card border border-line bg-surface px-5 py-10 text-center text-muted">
          No XP yet.{" "}
          <Link href="/log" className="text-accent hover:underline">
            Log a set →
          </Link>
        </p>
      ) : (
        <div className="mt-8">
          <h2 className="eyebrow mb-3">Where your XP came from</h2>
          <div className="overflow-hidden rounded-card border border-line">
            {breakdownEntries.map(([source, xp]) => (
              <div
                key={source}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"
              >
                <span className="text-sm text-fg">{SOURCE_LABEL[source] ?? source}</span>
                <span className="num text-xs text-data">{xp.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-faint">
            XP rewards completing your prescribed plan and logging honestly — never lifting heavier
            or piling on extra volume.
          </p>
        </div>
      )}
    </div>
  );
}
