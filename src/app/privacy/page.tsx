import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ScoreFit collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "June 18, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 text-sm leading-relaxed text-muted">
      <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Privacy Policy</h1>
      <p className="mt-1 text-xs text-faint">Last updated: {UPDATED}</p>
      <p className="mt-4">
        ScoreFit (&quot;we&quot;, &quot;us&quot;), operated at <b>scorefit.net</b>, provides this training-log
        service. This policy explains what data we collect, why, and the choices you have. We keep data
        collection to the minimum needed to run your training log and the features you opt into.
      </p>

      <S t="Information we collect">
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li><b>Account:</b> email address, an optional name, your birth <i>year</i> (year only — never your full date of birth, collected at sign-up for an age check), and a hashed password (we never store your password in plain text).</li>
          <li><b>Training data:</b> the sets you log — exercise, sets, reps, weight, RPE, and timestamps — plus derived progress, streaks, and achievements.</li>
          <li><b>Settings:</b> your unit preference and timezone (used to bucket sessions into your local day).</li>
          <li><b>Leaderboards (only if you opt in):</b> a public display name and the consistency/PR standings derived from your training, shown to other signed-in members.</li>
          <li><b>Moderation:</b> if you report content, we store the report (what was reported, the reason, and your account as the reporter) so we can review and act on it.</li>
          <li><b>Security:</b> two-factor settings, and short-lived hashed codes for email/password verification. We log limited technical data (e.g. error events, rate-limit counters) to operate the service.</li>
        </ul>
        We do <b>not</b> collect payment information, and we do not run third-party advertising trackers.
      </S>

      <S t="How we use it">
        To provide and secure your account; to run your log, progress, and gamification (XP, streaks,
        achievements); to send transactional email (verification, 2FA, and any reminders you enable); and, if
        you opt in, to compute leaderboard standings. Your birth year is used solely for the minimum-age gate
        and age cohorts. We never sell your personal data.
      </S>

      <S t="Legal bases (EEA/UK)">
        We process your data to perform our contract with you (running the service), on the basis of your
        consent (e.g. leaderboards, optional reminders), and for our legitimate interests in securing and
        improving the service. You can withdraw consent at any time.
      </S>

      <S t="What is shared">
        Nothing about you is public by default. Leaderboards are strictly opt-in; only then do your chosen
        display name, your consistency %, and your personal-record count become visible to other signed-in
        members. Your raw weights, body data, email, and full logs are never shown to others. We use trusted
        infrastructure providers (database and email delivery) that process data on our behalf under
        appropriate safeguards; we do not otherwise disclose your data except where required by law.
      </S>

      <S t="Cookies">
        We use a single, essential, encrypted session cookie to keep you signed in. We do not use advertising
        or cross-site tracking cookies.
      </S>

      <S t="Retention">
        We keep your data while your account is active. When you delete your account, your training,
        gamification, and leaderboard data are removed by cascade. Verification codes are short-lived and
        deleted as they expire or are used.
      </S>

      <S t="Your rights">
        You can access and export your training data, correct your details, and delete your account and data
        at any time from the account page. Depending on where you live, you may also have rights to restrict
        or object to certain processing and to lodge a complaint with a supervisory authority. To exercise a
        right we can&apos;t self-serve, contact us at the address below.
      </S>

      <S t="Security">
        Passwords are hashed with bcrypt; 2FA secrets are encrypted; verification codes are stored only as
        hashes. We enforce same-origin checks and rate limiting on sensitive endpoints. No system is perfectly
        secure, but we work to protect your data and to limit what we collect.
      </S>

      <S t="Children">
        We ask for your birth year at sign-up. ScoreFit&apos;s public and social features (leaderboards, and
        later any social features) are not directed to children under 13, and members under 13 are blocked
        from joining them; the private training log itself remains available. If you believe a child has
        provided us data in violation of this, contact us and we will delete it.
      </S>

      <S t="Changes & contact">
        We may update this policy; we&apos;ll revise the date above and, for material changes, notify you in
        the app. Questions or requests: <a className="text-accent hover:underline" href="mailto:privacy@scorefit.net">privacy@scorefit.net</a>.
      </S>

      <p className="mt-8 text-xs text-faint">
        This policy describes our actual data practices. Privacy law varies by region; for jurisdiction-specific
        obligations we consult qualified counsel.
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
