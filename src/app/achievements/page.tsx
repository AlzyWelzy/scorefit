import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserAchievements, getAchievementProgress } from "@/db/game";
import { getUserById } from "@/db/users";
import { ACHIEVEMENTS } from "@/lib/game/achievements";
import { GamificationOff } from "@/components/GamificationOff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Achievements",
  alternates: { canonical: "/achievements" },
  robots: { index: false, follow: false },
};

const TIER_CLASS: Record<string, string> = {
  bronze: "text-[#c08457]",
  silver: "text-[#b8c0c8]",
  gold: "text-[#e3b341]",
};

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/achievements");

  const [user, earned, progress] = await Promise.all([
    getUserById(session.user.id),
    getUserAchievements(session.user.id),
    getAchievementProgress(session.user.id),
  ]);

  if (user?.gamificationOptOut) return <GamificationOff title="Trophy room" />;

  const earnedMap = new Map(earned.map((e) => [e.achievementId, e]));
  const progressMap = new Map(progress.map((p) => [p.key, p]));

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Trophy room</span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Achievements</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="num text-xs text-muted">
            {earned.length} / {ACHIEVEMENTS.length} unlocked
          </span>
          <Link href="/profile" className="text-sm text-data hover:underline">
            ← Profile
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const got = earnedMap.get(a.id);
          const p = progressMap.get(a.progressKey);
          const hiddenLocked = a.hidden && !got;
          const value = p?.progressValue ?? 0;
          const max = p?.progressMax ?? null;
          const pct = max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : got ? 100 : 0;
          return (
            <div
              key={a.id}
              className={`rounded-card border p-4 ${got ? "border-accent/40 bg-surface" : "border-line bg-surface/40"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-medium ${got ? "text-fg" : "text-muted"}`}>
                  {hiddenLocked ? "??? Hidden" : a.title}
                </span>
                {got?.tier && (
                  <span className={`eyebrow ${TIER_CLASS[got.tier] ?? "text-data"}`}>{got.tier}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-faint">
                {hiddenLocked ? "Keep training to discover this one." : a.description}
              </p>
              {got ? (
                <p className="num mt-2 text-[11px] text-accent">Unlocked</p>
              ) : (
                max != null &&
                !hiddenLocked && (
                  <>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-data/50" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="num mt-1 text-right text-[11px] text-faint">
                      {Math.round(value)} / {max}
                    </p>
                  </>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
