import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using ScoreFit.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 text-sm leading-relaxed text-muted">
      <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Terms of Service</h1>
      <p className="mt-2 rounded-card border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
        TEMPLATE — review and finalize with legal counsel before enabling public/social features.
      </p>

      <Section title="Not medical advice">
        ScoreFit provides general fitness information and tools. It is not medical advice. Consult a qualified
        professional before starting any program, and stop and seek help if you experience pain or injury.
      </Section>
      <Section title="Train at your own risk">
        Resistance training carries inherent risk. You are responsible for training within your ability and
        for your own safety. Gamification (streaks, XP, challenges, leaderboards) is for motivation only and
        must never be a reason to train through pain, illness, or prescribed rest.
      </Section>
      <Section title="Honest participation">
        Leaderboards rely on honest logging. Fabricating data or attempting to game the rankings may result in
        removal from social features (without affecting your private training log).
      </Section>
      <Section title="Conduct">
        Be respectful. Harassment, impersonation, and abusive content are prohibited and may lead to
        suspension of social privileges.
      </Section>
      <Section title="Eligibility">
        You must meet the minimum age stated in our Privacy Policy to use social/leaderboard features.
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
