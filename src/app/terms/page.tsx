import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using ScoreFit.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "June 18, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 text-sm leading-relaxed text-muted">
      <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Terms of Service</h1>
      <p className="mt-1 text-xs text-faint">Last updated: {UPDATED}</p>
      <p className="mt-4">
        These terms govern your use of ScoreFit, operated at <b>scorefit.net</b> (&quot;we&quot;, &quot;us&quot;).
        By creating an account or using the service, you agree to them. Please read the health and risk
        sections carefully.
      </p>

      <S t="1. Eligibility">
        You must be old enough to form a binding contract in your country. Our public and social features
        (leaderboards, and later any social features) require you to be at least <b>13</b>; we collect your
        birth year at sign-up to enforce this. The private training log itself is available regardless. You&apos;re
        responsible for keeping your account credentials secure.
      </S>

      <S t="2. The service">
        ScoreFit provides training programs, an exercise library, a workout log, progress tracking, and
        optional gamification (XP, streaks, achievements, and opt-in leaderboards). We may change, add, or
        remove features over time.
      </S>

      <S t="3. Not medical advice">
        ScoreFit provides general fitness and educational information and tools. It is <b>not</b> medical
        advice, diagnosis, or treatment, and it is not a substitute for a qualified professional. Consult a
        physician before starting any exercise program, especially if you have a health condition, are
        pregnant, or are returning from injury.
      </S>

      <S t="4. Assumption of risk">
        Resistance training carries inherent risks, including serious injury. You voluntarily choose to train
        and accept those risks. You are solely responsible for exercising within your ability, using proper
        form and equipment, and stopping if you experience pain, dizziness, or other warning signs.
      </S>

      <S t="5. Gamification is motivation only">
        Streaks, XP, challenges, and leaderboards exist to encourage consistency. They are <b>never</b> a
        reason to train through pain, illness, or prescribed rest, to skip recovery, or to manipulate your
        body weight. Our streak and scoring systems are deliberately designed so that doing more than your
        program prescribes earns nothing.
      </S>

      <S t="6. Honest participation & conduct">
        Leaderboards rely on honest logging. Fabricating data, exploiting bugs, or attempting to manipulate
        rankings, and any harassment, impersonation, hateful, or abusive behavior, are prohibited. You can
        report content that breaks these rules; we review reports and may remove content and suspend your
        access to social/leaderboard features for violations — without affecting your private training log.
      </S>

      <S t="7. Your content">
        You retain ownership of the data you create (e.g. your logs and any display name). You grant us the
        limited rights needed to store and display it to operate the features you use (for example, showing
        your display name and standings on a leaderboard you opted into).
      </S>

      <S t="8. Accounts & termination">
        You may delete your account at any time from the account page. We may suspend or terminate accounts
        that violate these terms or that we&apos;re required to act on by law. On deletion, your associated
        data is removed as described in the Privacy Policy.
      </S>

      <S t="9. Disclaimers & limitation of liability">
        The service is provided &quot;as is&quot; without warranties of any kind, to the fullest extent
        permitted by law. To the maximum extent permitted by law, ScoreFit and its operators are not liable
        for any injury, loss, or damages arising from your use of the service or your training. Some
        jurisdictions don&apos;t allow certain limitations, so parts of this section may not apply to you.
      </S>

      <S t="10. Changes & contact">
        We may update these terms; we&apos;ll revise the date above and notify you of material changes in the
        app. Continued use after changes means you accept them. Questions:{" "}
        <a className="text-accent hover:underline" href="mailto:support@scorefit.net">support@scorefit.net</a>.
      </S>

      <p className="mt-8 text-xs text-faint">
        Governing law and dispute-resolution terms are those of the jurisdiction in which ScoreFit is
        operated; for jurisdiction-specific obligations we consult qualified counsel.
      </p>
    </div>
  );
}

function S({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-semibold text-fg">{t}</h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}
