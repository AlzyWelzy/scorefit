# Eating-Disorder Safety Review — ScoreFit competitive/gamified surfaces

**Date:** 2026-06-18 · **Scope:** the leaderboards + gamification surfaces that ship
behind `LEADERBOARDS_ENABLED` / `SOCIAL_ENABLED`. **Status:** design review complete;
the shipped surfaces are cleared. A **clinical review by a qualified professional is
still recommended before adding any quarantined feature** (see below) — this document
is the engineering-side record, not a clinical sign-off.

This satisfies the "ED-safety review" box in [LEADERBOARDS_SAFETY.md](LEADERBOARDS_SAFETY.md)
for the **currently built** boards. Re-run this review (and update the date) before
un-quarantining anything in the deferred list.

---

## Why this review exists

The product's own adversarial review (see [GAMIFICATION.md](GAMIFICATION.md) → safety
section) flagged that bodyweight-relative scoring, weight-class bucketing, and progress
photos *reward lower bodyweight* and create eating-disorder (ED) incentives that
rate-limiting only blunts. The rule we adopted: **no public metric may reward being
lighter, and no surface may rank people by body composition.**

## What the shipped surfaces actually expose (and why each is cleared)

| Surface | Metric | ED-risk assessment |
|---|---|---|
| Consistency board | rolling 4-week kept-week % (capped at 100) | Adherence only. **Capped** so logging *more* can't raise it. No body metric. ✅ |
| Volume-PR board | count of honest (non-flagged) personal records | Self-relative — beats *your own* prior best. Independent of bodyweight. ✅ |
| XP / levels | completing the prescribed plan | Doing more than prescribed earns 0; never scales with load. ✅ |
| Streaks | kept *weeks* (rest/deload don't break) | Deliberately not a daily chain; rest is rewarded, not punished. ✅ |
| Achievements | consistency / collection / honest-logging | No weight-loss or body-composition badge exists. ✅ |

Verified against source: `src/db/leaderboard.ts` exposes exactly the two boards above
and nothing else; `src/lib/game/xp.ts` never multiplies by weight; no bodyweight,
body-fat, measurement, or photo field is collected anywhere in `src/db/schema.ts`.

## Structural guarantees (not just policy)

- **Bodyweight is private-only, never competitive.** A `body_metrics` table exists for
  an opt-in personal bodyweight trend (`/progress`), but it is NEVER fed into any
  leaderboard, XP calculation, achievement, or public/social surface — verified in
  `src/db/leaderboard.ts` (ranks consistency % + PR count only) and `src/db/game.ts`
  (no bodyweight input). No progress-photo storage exists. The cutting incentive has no
  competitive input: being lighter cannot improve any ranked metric.
- **Birth *year* only** (never full DOB) — minimal PII, used solely for the age gate.
- **A hard "disable all gamification" switch** (`users.gamificationOptOut`) lets any
  user remove XP/levels/streaks/achievements entirely and use ScoreFit as a plain log.
- **The Terms explicitly state** (§5) that gamification is "never a reason to … manipulate
  your body weight." This is reinforced by the mechanics, not just the copy.

## Quarantined — DO NOT ship without a clinical ED-safety review

These remain off the default path and require a review by a qualified professional
(e.g. a clinician with ED expertise) **before** any implementation:

- Bodyweight-relative or DOTS / weight-class / strength-to-bodyweight rankings.
- Progress photos or any appearance/body-composition content.
- Any board, badge, or challenge whose score improves as bodyweight drops.

If such a feature is ever requested, treat this file as the gate: schedule the clinical
review, record the outcome here, and only then change the quarantine status.

## Re-review triggers

Re-open this review if any of the following change: a new public metric is added; any
body-composition data point is collected; the age gate changes; or a social feature
(feed/captions/follows) ships.
