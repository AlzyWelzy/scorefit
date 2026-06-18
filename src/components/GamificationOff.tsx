import Link from "next/link";

/**
 * Shown on gamified surfaces (Training Score, Trophy room) when the user has turned
 * gamification off via the account switch. No XP / levels / badges are displayed —
 * the whole point of the switch is that those mechanics are absent, not just hidden
 * behind a number. Training data (logs, progress, export) stays available elsewhere.
 */
export function GamificationOff({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <span className="eyebrow">{title}</span>
      <div className="mt-6 rounded-card border border-line bg-surface px-5 py-10 text-center">
        <p className="text-fg">Gamification is turned off for your account.</p>
        <p className="mt-2 text-sm text-muted">
          XP, levels, streaks and achievements are disabled. Your training logs and
          progress are unaffected.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
          <Link href="/progress" className="text-data hover:underline">
            View progress →
          </Link>
          <Link href="/account" className="text-accent hover:underline">
            Re-enable in account settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
