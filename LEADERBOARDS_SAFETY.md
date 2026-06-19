# Leaderboards & Social — Enablement Checklist

Leaderboards (Phase 3) and social (Phase 5) are **built but shipped OFF** behind
feature flags (`src/lib/flags.ts`): `LEADERBOARDS_ENABLED`, `SOCIAL_ENABLED`. They
publish health-adjacent personal data, so do **not** flip them on until every box
below is checked. This is the gate the project's own adversarial review flagged as
launch-blocking (see [GAMIFICATION.md](GAMIFICATION.md) → safety section).

## What's already built (safe by construction)

- **Only two PII-free, fabrication-proof boards** are exposed: Consistency % (capped)
  and self-relative Volume-PR count. Heavier weight / lying about load cannot win.
- **Opt-in only**, default off (`users.leaderboardOptIn`). Nothing is public until a
  user explicitly joins.
- **Age gate at registration AND opt-in**: birth year is collected at sign-up
  (`src/components/auth/RegisterForm.tsx` → `POST /api/register`), and `meetsMinAge()`
  (`src/lib/flags.ts`) blocks under-`MIN_AGE` users from joining/seeing the boards
  (`src/app/leaderboards/page.tsx`, `src/app/api/account/route.ts`). `MIN_AGE = 13`.
- **Minimal PII**: birth *year* only (never full DOB); a vanity display name distinct
  from the auth name; anonymized fallback `Lifter#xxxx`.
- **`noindex`** on `/leaderboards`; robots disallow includes `/leaderboards` and `/admin`.
- **Consent timestamp** (`users.acceptedTermsAt`) recorded on opt-in, behind an honor
  pledge + Terms/Privacy acceptance.
- **Account deletion** cascades to all leaderboard data (GDPR erasure path).
- **Data export covers consent/leaderboard fields** (`GET /api/logs/export` includes
  birth year, display name, opt-in, consent timestamp; `?format=json` for the full doc).
- **Gamification kill-switch** (`users.gamificationOptOut`) removes a user from boards.
- **Moderation foundation is live** (built ahead of social): `users.isAdmin`, a
  content-type-agnostic `reports` table, `users.suspendedSocialAt` (suspends social
  privileges only — never the training account), `POST /api/reports`, an admin-gated
  `POST /api/admin/reports`, and the `/admin` review queue.
- **Privacy Policy (`/privacy`) and Terms (`/terms`) are finalized** (operator =
  ScoreFit / scorefit.net, real "Last updated" date, no TEMPLATE markers).

## Before flipping `LEADERBOARDS_ENABLED=true`

- [x] **Privacy Policy and Terms finalized in-app** — operator identity set, dates
      current, TEMPLATE hedges removed. *(Still recommended: a counsel review for the
      specific market you launch in — these reflect actual practice, not legal sign-off.)*
- [x] **Minimum age decided: 13** (COPPA floor). `MIN_AGE = 13`, copy matches in the
      register form, Terms §1, and Privacy. *If you launch in an EU market with a higher
      GDPR-K age, raise `MIN_AGE` — the gate is centralized so it's a one-line change.*
- [x] **Registration-level age gate** — birth year collected at sign-up and stored;
      under-`MIN_AGE` users keep the private log but are blocked from public/social.
- [x] **Upstash rate limiting available + enforceable in production** — `assertEnv()`
      warns loudly when `UPSTASH_*` is missing and hard-fails boot only when
      `REQUIRE_UPSTASH=true` (fail-closed opt-in). Default is graceful degradation to
      in-memory limiting so a missing-env deploy never bricks login. **To go fail-closed
      for launch, set `REQUIRE_UPSTASH=true` with the Upstash vars configured.**
- [x] **Data-export + delete flows cover leaderboard/consent fields** — export includes
      them; delete cascades them.
- [x] **ED-safety review** — design review complete and recorded in
      [ED_SAFETY_REVIEW.md](ED_SAFETY_REVIEW.md); shipped boards are cleared. DOTS /
      weight-class / bodyweight-relative boards remain **quarantined** pending a clinical
      review (see that file).
- [x] **Moderation in place before SOCIAL** — `isAdmin`, `reports`, social-suspension,
      and the `/admin` queue exist. *Before flipping `SOCIAL_ENABLED`: grant at least one
      admin (`UPDATE users SET is_admin = true WHERE …`) and build the actual social
      content (feed/follows) the reports will point at.*

## To enable (when the boxes are checked)
Set `LEADERBOARDS_ENABLED=true` (and later `SOCIAL_ENABLED=true`) in the production
environment. No code change required. (`SOCIAL_ENABLED` still needs the Phase 5 social
features themselves — only the moderation/safety scaffolding is built so far.)
