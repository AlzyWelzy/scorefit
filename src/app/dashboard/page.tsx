import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Flame, Gauge, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { getStreakSummary } from "@/db/streaks";
import { getGameProfile } from "@/db/game";
import { getBestE1rmByExercise } from "@/db/logs";
import { getProgramPrescription, PROGRAM_META, isProgramId, type ProgramId } from "@/lib/data";
import { e1rm } from "@/lib/strength";
import { resolveLocalDate } from "@/lib/time";
import { TodayCardMount } from "@/components/TodayCardMount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const program: ProgramId = isProgramId(user.currentProgram ?? "") ? (user.currentProgram as ProgramId) : "beginner";
  const week = user.currentWeek ?? 1;
  const unit = session.user.unit;
  const gamificationOn = !user.gamificationOptOut;

  const [streak, profile, bestRows] = await Promise.all([
    gamificationOn ? getStreakSummary(user.id, resolveLocalDate(session.user.timezone)) : Promise.resolve(null),
    gamificationOn ? getGameProfile(user.id) : Promise.resolve(null),
    getBestE1rmByExercise(user.id, program),
  ]);

  const { nameBySlug } = getProgramPrescription(program);
  const prs = bestRows
    .map((b) => ({ name: nameBySlug.get(b.exerciseSlug) ?? b.exerciseSlug, e1rm: Math.round(e1rm(b.weight, b.reps)) }))
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 3);

  const greeting = user.displayName?.trim() || user.name?.trim() || "there";

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <span className="eyebrow-accent">Dashboard</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Welcome back, {greeting}</h1>

      {/* Resume + today */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/log" className="card card-hover group flex items-center justify-between gap-3 p-5">
          <span>
            <span className="eyebrow">resume training</span>
            <span className="mt-1 block font-display text-lg font-semibold text-fg group-hover:text-accent">
              {PROGRAM_META[program].name} · Week {week}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-faint transition-colors group-hover:text-accent" />
        </Link>
        <TodayCardMount />
      </div>

      {/* Gamification snapshot */}
      {gamificationOn && (streak || profile) && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat icon={<Flame className="h-4 w-4 text-accent" />} label="week streak" value={`${streak?.currentStreak ?? 0}`} />
          <Stat icon={<Gauge className="h-4 w-4 text-data" />} label="consistency" value={`${streak?.rollingConsistency ?? 0}%`} />
          <Stat icon={<Trophy className="h-4 w-4 text-data" />} label={profile?.title ?? "level"} value={`L${profile?.level ?? 1}`} />
        </div>
      )}

      {/* Recent PRs */}
      {prs.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">Top estimated 1RMs</h2>
            <Link href="/progress" className="text-xs text-data hover:underline">All progress →</Link>
          </div>
          <div className="card mt-2 overflow-hidden p-0">
            {prs.map((pr) => (
              <div key={pr.name} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
                <span className="truncate text-sm text-fg">{pr.name}</span>
                <span className="num shrink-0 text-xs text-data">
                  e1RM {pr.e1rm} {unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/progress" className="text-data hover:underline">Progress →</Link>
        {gamificationOn && <Link href="/achievements" className="text-data hover:underline">Achievements →</Link>}
        {gamificationOn && <Link href="/profile" className="text-data hover:underline">Training Score →</Link>}
        <Link href="/programs" className="text-data hover:underline">Programs →</Link>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="num text-xl font-bold text-fg">{value}</span>
      </div>
      <div className="eyebrow mt-0.5 truncate">{label}</div>
    </div>
  );
}
