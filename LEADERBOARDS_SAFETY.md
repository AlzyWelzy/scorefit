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
- **Age gate** at opt-in: requires birth year, blocks under-13 (`MIN_AGE`, COPPA floor).
- **Minimal PII**: birth *year* only (never full DOB); a vanity display name distinct
  from the auth name; anonymized fallback `Lifter#xxxx`.
- **`noindex`** on `/leaderboards`; robots disallow.
- **Consent timestamp** (`users.acceptedTermsAt`) recorded on opt-in, behind an honor
  pledge + Terms/Privacy acceptance.
- **Account deletion** cascades to all leaderboard data (GDPR erasure path).
- Privacy Policy (`/privacy`) and Terms (`/terms`) scaffolds exist.

## Before flipping `LEADERBOARDS_ENABLED=true`
- [ ] **Finalize the Privacy Policy and Terms with legal counsel** (the pages are
      templates marked "TEMPLATE — review with counsel"). Set the "Last updated" date.
- [ ] **Decide the real minimum age** for your markets (COPPA 13 / UK 13 / EU GDPR-K
      up to 16) and confirm `MIN_AGE` + copy match.
- [ ] **Add a registration-level age gate** if you collect data from minors at signup
      (this MVP only gates the leaderboard opt-in, not registration).
- [ ] **Make Upstash rate limiting mandatory in production** (anti-abuse for all the
      write paths depends on it — see IMPROVEMENTS.md P0 #6).
- [ ] **Confirm the data-export + delete flows** cover leaderboard/consent fields.
- [ ] **ED-safety review**: the shipped boards avoid bodyweight/relative-strength
      ranking by design. Do NOT add DOTS/weight-class/bodyweight-relative boards
      without a dedicated eating-disorder-safety review.
- [ ] **Moderation** must be in place before SOCIAL is enabled (reports + admin +
      soft-delete) — see the social tables and `users.isAdmin` (Phase 5).

## To enable (when the boxes are checked)
Set `LEADERBOARDS_ENABLED=true` (and later `SOCIAL_ENABLED=true`) in the production
environment. No code change required.
