import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ScoreFit handles your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 text-sm leading-relaxed text-muted">
      <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Privacy Policy</h1>
      <p className="mt-2 rounded-card border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
        TEMPLATE — review and finalize with legal counsel before enabling public/social features.
      </p>

      <Section title="What we collect">
        Account data (email, optional name), your training logs (exercises, sets, reps, weight, RPE), your
        timezone, and — only if you opt into leaderboards — a display name and birth year (year only, never
        full date of birth). We do not collect payment data.
      </Section>
      <Section title="How we use it">
        To run your training log, progress, and gamification (XP, streaks, achievements). Birth year is used
        solely to enforce a minimum-age gate and, if offered, age cohorts. We never sell your data.
      </Section>
      <Section title="What's public">
        Nothing is public by default. Leaderboards are strictly opt-in; only then do your display name,
        consistency %, and personal-record count become visible to other members. Your raw weights, body
        data, and logs are never shown to others.
      </Section>
      <Section title="Your rights">
        You can export or delete your data and account at any time from the account page; deletion removes
        all associated training, gamification, and leaderboard data. For access/erasure requests, contact us.
      </Section>
      <Section title="Minimum age">
        ScoreFit&apos;s social/leaderboard features are not directed to children under 13. We do not knowingly
        let under-13 users join them.
      </Section>
      <p className="mt-8 text-xs text-faint">Last updated: (set on finalization).</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-1">{children}</p>
    </section>
  );
}
