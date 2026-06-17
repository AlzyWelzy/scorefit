# ScoreFit — Gamification Design & Roadmap

Streaks, leaderboards, groups, achievements, XP, and challenges — designed for a
**science-based hypertrophy** product, not a powerlifting meet. Every mechanic is built to
reinforce good training (consistency, completion, honest logging, gradual overload) and to
**structurally refuse to reward overtraining, ego-lifting, or fabricated logs.**

> **Companion doc:** [IMPROVEMENTS.md](IMPROVEMENTS.md) covers the codebase audit. The two
> share one critical-path dependency: a dated `workout_sessions` table.

---

## The one decision that makes all of this work

Workout logs are keyed by `program/week/day` coordinates with only a *mutable* `updatedAt`
([src/db/schema.ts:68-90](src/db/schema.ts#L68-L90)). Nothing time-based exists yet. Every
feature below — streaks, leaderboard windows, feeds, achievements-by-day, XP cadence,
challenges — is a date-range query that has nothing to query.

**Do NOT build six features each inventing its own session table** (the design panel produced
4–6 conflicting `workout_sessions` proposals with different keys and "qualifying" floors).
Build **one canonical dated entity + one event engine**, and make every mechanic a read over it.

```
workout_logs        immutable per-set truth ............... UNCHANGED
   │  (on each completed set, inside upsertSetLog)
   ▼
workout_sessions    "user trained day D on calendar date X"  ◄── THE missing primitive
   │
   ▼
xp_events (ledger)  append-only economy truth (idempotent, reversible)
   │
   ▼
projections/caches  user_game_profile · weekly_consistency
                    user_achievements · leaderboard_scores ... all recomputable
```

### Two non-negotiable constraints (baked into every system)
1. **Never reward raw weight / tonnage / daily frequency** — not in XP, streaks, achievements,
   or public boards. Weight only ever feeds *your own private* PR comparison. This is the
   anti-ego-lift, anti-overtraining, **and** anti-cheat mechanism at once.
2. **Never trust client dates or self-reported load for competition** — `sessionDate` is
   derived **server-side** from the user's timezone and **frozen on first write**; flagship
   boards are self-relative or capped.

---

## The event engine

One function, `evaluateGameEvents(userId, writtenRow, priorRow)`, called from
[upsertSetLog](src/db/logs.ts#L84) — **not** just the API route, because the offline outbox
([src/lib/logOutbox.ts](src/lib/logOutbox.ts)) funnels through it too. `POST /api/logs`
returns `newlyUnlocked[]`/`newPRs[]` so the Logger can toast.

Per write, in **one DB transaction** wrapped in try/catch so a game-layer failure **never**
blocks saving the set:

1. **Session upsert** — compute the user's **local** date from `users.timezone` (server-side),
   upsert the `workout_sessions` row, recompute distinct-exercises/completed-sets/tonnage from
   that day's completed logs, set `qualifies` against the honesty floor, **freeze `sessionDate`
   on first insert** (later edits never move it).
2. **XP** — append idempotent `xp_events` (`UNIQUE(userId, source, refKey)`): prescribed-set
   completion with steep junk-volume decay, flat log-quality bonus, rate-limited + plausibility-
   gated PR bonus. Un-completing writes a negative reversal row. Daily soft/hard caps applied.
3. **PR detection** — Epley e1RM via a **shared** helper (extract the inline one from
   [progress/page.tsx:14](src/app/progress/page.tsx#L14) into `src/lib/game/strength.ts`).
   Compare to the per-exercise best; insert `prEvents` (flagged, not rewarded, if >15% jump).
4. **Achievements** — run only rules whose `touchedBy(writtenRow)` predicate matches (keeps it
   O(handful)); update `achievement_progress`; insert `user_achievements` ON CONFLICT.
5. **Leaderboard** — upsert the acting user's `leaderboard_scores` rows; rank stays read-time
   via `RANK() OVER`.

**Week-close + reconcile (cron, deferred past MVP):** finalize `weekly_consistency` after the
~36h grace window, apply freezes, advance/break streaks, fire milestones, rebuild leaderboards
per closed window, run the outlier sweep, reconcile caches from the ledgers. The streak +
consistency MVP needs no cron — it's computed lazily on read.

**Offline batching:** `logOutbox` flushes in a burst, so the engine must process a batch then
award **once** (settle the heaviest set's PR, not each intermediate). Idempotent ledger keys
make replay safe.

---

## Canonical data model (9 new tables + 3 user columns)

> Merges the design panel's ~30 proposed tables into one of each. `users` gains only 3 columns
> in early phases; `workout_logs` is unchanged.

```
users (ALTER): + timezone text NOT NULL default 'UTC'  (IANA, server-side local-date + quiet hours)
               + weekStartsOn int NOT NULL default 1    (1 = Mon)
               + goalSessionsPerWeek int NULL           (null = use program-prescribed target)
```

| Table | Key columns | Purpose |
|-------|-------------|---------|
| **workout_sessions** | `userId, sessionDate (local, frozen), program, week, daySlug, distinctExercises, completedSets, tonnage, bestE1rm, qualifies, committedAt, backfilled` · UNIQUE(userId,program,week,daySlug) · INDEX(userId,sessionDate) | **THE foundation.** One row per training day, derived from completed logs inside `upsertSetLog`. Every date-based feature reads from here. `qualifies` = ≥3 completed sets OR ≥2 distinct exercises (honesty floor). |
| **xp_events** | `userId, amount (neg=reversal), source, refKey, eventDate (=sessionDate), seasonId, meta jsonb` · UNIQUE(userId,source,refKey) | Append-only economy ledger = source of truth for ALL XP. Idempotent (no double-pay on re-save), reversible (un-complete writes negative). `user_game_profile` is recomputable from this. |
| **user_game_profile** | `userId PK, totalXp, level, title, seasonXp, seasonId, prestige, currentStreakWeeks, longestStreakWeeks, freezesAvailable (cap 2), rollingConsistency, bestE1rm jsonb` | ONE denormalized per-user summary. O(1) reads for profile/progress header/leaderboard. Holds streak+freeze state, XP/level/season, and the per-exercise best-e1RM map driving PR detection. |
| **weekly_consistency** | `userId, weekStart, program, targetSessions, qualifyingSessions, prescribedSets, completedSets, score (0-100), isDeload, kept, freezeUsed, finalizedAt` · UNIQUE(userId,weekStart) | **The shared spine.** Drives the kept-week streak, the 0-100 score, the consistency leaderboard, the XP perfect-week bonus, the calendar cells, and deload-adherence achievements. Deload-aware target stored explicitly so rest/deload can never break a streak. |
| **user_achievements** | `userId, achievementId (slug), tier, evidence jsonb, unlockedAt` · UNIQUE(userId,achievementId) | Idempotent one-time badge ledger; tiered badges upgrade in place. Definitions live in **code** (`src/lib/game/achievements.ts`) — no defs table, no seed migration. Rarity = COUNT at read time. |
| **achievement_progress** | `userId, key, progressValue, progressMax, meta jsonb` · UNIQUE(userId,key) | Cheap running counters toward locked/tiered/collection badges so the engine never rescans `workout_logs`. Renders "11/53", "400kg to next landmark" instantly. `meta` holds seen-slug sets + per-coord prior tonnage for edit-safe deltas. |
| **prEvents** | `userId, exerciseSlug, kind (e1rm/volume), valueKg, e1rmGainPct, occurredOn, flagged, broadcast` · INDEX(userId,exerciseSlug,kind) | Append-only PR ledger via the shared Epley helper. Feeds the self-relative PR-count leaderboard, the rate-limited PR XP, and (later) feed events. `flagged` (>15% jump) = recorded but NOT rewarded/broadcast — kills the incentive to fabricate. |
| **leaderboard_scores** | `userId, board, exerciseSlug, scope, scopeKey, window, windowKey, rawValue, score, flagged` · UNIQUE(userId,board,exerciseSlug,scope,scopeKey,window,windowKey) | Materialized leaderboard facts. Rank computed at **read** time via `RANK() OVER (PARTITION BY board,scope,window ORDER BY score DESC)` — volatile rank ints never persisted. `flagged` rows stay for audit, drop off public reads. |
| **social tables (Phase 5, deferred)** | `follows, blocks, activity_events, reactions, groups, group_members, reports` + `users.profileVisibility default 'friends'` | Reuse the foundation: `activity_events` emit from `workout_sessions` commit + `prEvents (broadcast only)` + streak milestones. "Friends" = mutual follow (derived, no separate table). Deferred — largest moderation/privacy surface. |

---

## The six systems

### 🔥 Streaks — week-based, not a daily chain
**The most important design call.** A daily "don't break the chain" streak is *actively
dangerous* here: it punishes prescribed Wed/Sun rest and W1/W6 deloads and pushes people to
train injured.

- **Unit = the kept week.** A week is kept when distinct qualifying sessions ≥ that week's
  prescribed training days — automatically **lowered** on deloads (`min(target,3)`), **never
  raised**. So correctly taking it easy still keeps the streak.
- **Graded 0–100 Weekly Consistency Score** alongside the binary streak — a 4/5 week reads
  "85%, keep going" instead of a brutal reset (avoids the what-the-hell effect).
- **Scarce, non-stockpiling freezes** (1 per 4 kept weeks, cap 2), a Monday **grace window**,
  and a GitHub-style calendar where **rest renders as "kept," not as a gap**.
- **Milestones reward deload adherence** ("Completed a deload as prescribed"), never weight.
- Reminders fire only on prescribed training days, never on rest/deload, with an honest
  off-ramp ("…but skip it if you're beat").

### 🏆 Leaderboards — self-relative & adherence-first
For a hypertrophy audience the flagship boards need no PII and no verification:

- **Consistency %** — completed prescribed sets / prescribed, **hard-capped at 100%** (logging
  *more* never raises it → no overtraining incentive).
- **Volume-PR Count** — count of PRs beating your *own* prior best → structurally un-winnable by
  being big or lying about load.
- Scopes: global + self-declared experience at MVP; weight-class / age / region / **friends**
  later. Windows: weekly resets / seasonal / all-time. Opt-in (`leaderboardOptIn`) + honor pledge.
- **Deferred & quarantined:** DOTS relative-strength, per-exercise e1RM, bodyweight-relative,
  weight-class — they need sensitive new PII (bodyweight, sex, age) and are the most cheatable,
  so they get **verification tiers** (`self` / `connected` / `verified`) and ship last.

### 👥 Social — groups, friends, feed
- **Asymmetric follow graph** (`follows`); "friends" = mutual follow (derived).
- **Groups/clubs** — gym crews, coach+client rosters (coach role gets an accountability
  dashboard via explicit, revocable member consent), friend squads.
- **Feed of system-generated events** (`session_completed`, `e1rm_pr`, `streak_milestone`,
  `program_completed`) — *not* free text, which keeps moderation tractable. Optional ≤140-char
  captions go through the report path.
- Single kudos reaction (one per user per event), opt-in comments.
- **Three-tier privacy, default friends-only.** Visibility snapshotted at emit AND re-evaluated
  at read (most restrictive wins) → going private retroactively narrows your footprint. Global
  sharing-pause kill switch. Blocks hard-override everything.
- **Moderation is a first-class requirement:** `reports` + soft-delete + `isAdmin` queue;
  suspend social privileges only, never the training account.
- PRs surface as personal bests ("X hit a new best on Bench"), **never cross-user weight rankings.**

### 🏅 Achievements — a log-write rule engine
Pure declarative rules (`{id, category, tier?, evaluate(ctx), touchedBy(row)}`) in code:

- **PR celebrations** (first-lift, e1RM, rep, set/day/week volume PRs) with a **±15% plausibility
  cap** so a fat-fingered 500kg curl mints nothing.
- **Program completion** — finishing a 12-week block, with quarter milestones (1/4, 1/2, 3/4) to
  fight the mid-program dropoff (goal-gradient effect).
- **Collection badges — nearly free given [movement.ts](src/lib/movement.ts):** "Exercise
  Explorer" (10/25/**53** distinct exercises), "Movement Master" (every archetype), "Tool
  Collector" (every equipment class).
- **Volume landmarks** — lifetime tonnage tiers with evocative names ("Moved a Bus").
- **Hidden achievements tied to *good* behavior:** "Deload Discipline" (logged the deload as
  prescribed), "Came Back" (returns after a 14+ day gap — rewards returning, never punishes
  leaving), "Honest Logger" (RPE on 50+ sets), "Balanced" (push/pull within 25%).
- **Restrained surfacing:** one celebratory toast at the moment of effort + a `/achievements`
  trophy room with rarity %. No push spam.

### 📈 XP / Levels ("Training Score")
XP rewards **completing the plan, not doing more**:

- Prescribed sets pay full (10 XP); extra junk sets decay (3 → 1 → 0). Out-of-program coords = 0.
- **Biggest source = weekly cadence bonus, capped at prescribed days** — a 6th/7th session pays
  nothing. The rational strategy is the medically sound one.
- Flat log-quality bonus (+2 for weight+reps, +1 for sane RPE) — rewards *completeness*, never
  magnitude → zero ego-lift pull.
- Rate-limited PR bonus inside a believable band (>0%, ≤15%, 7-day cooldown).
- Daily soft (×0.25 past threshold) + hard XP ceilings.
- Decelerating level curve `round(80·n^1.6)`; **maturity-based titles** (Novice → Architect,
  never strength-based — a consistent newcomer outranks a strong-but-flaky lifter).
- Quarterly **seasons** reset competitive XP; lifetime/level persist. Opt-in cosmetic prestige.
- Profile shows a **"where your XP came from"** breakdown so the system visibly teaches that
  consistency, not heaviness, is rewarded.

### ⚔️ Challenges
One idempotent `resolveChallenge(id)` across all kinds (frozen `finalScore` at resolution so
later log edits can't flip a settled result):

- **Personal consistency** ("4 of 5 days for 4 weeks" with grace).
- **Program completion** (configurable 80–100% threshold to respect deloads).
- **Group attendance / volume pools** — per-person daily caps so nobody overtrains to carry the
  team; attendance is the injury-neutral default, tonnage is opt-in.
- **1v1 duels** — default metric = attendance, not weight.
- **Monthly community seasons / themed events** ("Squat-tember") with personalized targets
  scaled to each user's baseline + an opt-in normalized leaderboard.
- **MVP = one auto-recurring weekly consistency challenge** everyone's implicitly enrolled in —
  proves the loop with zero new UI beyond a card on `/log`.

---

## ⚠️ Safety, ethics & legal gate — read before the first leaderboard

The adversarial critic's verdict: **the designs solved overtraining well and walked past the
bigger landmines.** These are launch-blockers, not polish.

- **No age gate.** Teenagers lift and will sign up. No birthdate at registration, no COPPA (<13),
  no GDPR-age-of-consent, no parental consent. Exposing minors to public leaderboards + body
  metrics + social comparison + ED-adjacent ranking is the highest-liability scenario in the
  plan. **Gate before any social / leaderboard / body-metric feature.**
- **Eating-disorder incentives.** Bodyweight-relative scoring and weight-class bucketing *reward
  lower bodyweight* — a cutting incentive rate-limiting only blunts. The designs **contradict
  each other**: social says "no appearance content," the features audit proposes **progress
  photos** (which also drag in CSAM-scanning, NCII/DMCA, and storage you don't have). Quarantine
  bodyweight-relative public ranking and progress photos behind an explicit ED-safety review.
- **No legal layer at all.** Zero privacy policy, ToS, data-export endpoint, or consent capture.
  Health data + bodyweight on a *public* leaderboard with none of that is a GDPR/CCPA violation
  on day one. Account deletion is a bare FK-cascade ([src/db/users.ts](src/db/users.ts)) that the
  new denormalized/feed tables break for Right-to-Erasure (cached display names, events in *other*
  users' feeds, frozen challenge results). **Write consent + data-lifecycle BEFORE the first board.**
- **Dark-pattern ethics.** Variable-ratio rewards, streak loss-aversion, and FOMO nudges aimed
  at a potentially ED-prone / minor population. Ship a hard **"disable all gamification"** switch,
  quiet-hours/frequency caps, and treat compulsion as a risk, not a feature.
- **Anti-abuse rides on a broken primitive.** Every "rate-limit follows/reactions/reports" reuses
  the in-memory limiter the security audit flagged as ineffective on serverless — **make Upstash
  mandatory in prod first** ([IMPROVEMENTS.md](IMPROVEMENTS.md) P0 #6).
- **Medical disclaimer / liability.** Gamification turns passive content into active "train now"
  instruction. Add a disclaimer + a pain/injury off-ramp wired into the *mechanics* (suppress
  nudges), not just the copy.
- **Write-path abuse.** XP/PR/challenge computation on the hot `upsertSetLog` path + burst-flushing
  outbox enables replay/spam farming; address collusion (mutual duel/group boosting) and Sybil
  (fake accounts — enforce an email-verification gate on social participation).
- **A11y/i18n carry-through.** Badge toasts, streak grids, leaderboard tables need reduced-motion
  respect, screen-reader semantics, and non-color-only state — don't repeat the audit's existing
  WCAG gaps. Safety-critical "this is a rest day" copy is currently monolingual.

---

## Phased roadmap

### Week 1 — quick wins (parallel, no deps — also de-risk everything after)
1. Extract `buildWeekCoordinates()` + `src/lib/game/strength.ts` `e1rm()` (both `/log` and
   `/progress` duplicate this; every gamification feature re-derives it).
2. Add `src/middleware.ts` (fail-closed chokepoint before new gamified routes exist).
3. `tokenVersion` bumps on 2FA disable / backup-code regen + `2fa-begin` rate limit.
4. `next-auth.d.ts` `ver`/`verAt` + `getProgram` map dispatch.
5. `noindex` convention on private pages.
6. `/progress` memoization + covering index.

### Phase 0 — Foundation (migration 0004, no visible game yet)
- `users.timezone` / `weekStartsOn` / `goalSessionsPerWeek`; create `workout_sessions`.
- Extract Epley + `validCoords`/`prescribed` math into `src/lib/game/`.
- Wrap `upsertSetLog` to upsert the session (frozen local `sessionDate`, `qualifies` floor).
- One-time backfill from `date(updatedAt)`, flagged `backfilled=true`. Capture client tz on login.
- **In parallel (independent):** Vitest + CI; env validation + Sentry + Vercel Cron + auto-migrate;
  **the legal / consent / age-gate layer.**

### Phase 1 — Streaks + Consistency (the safe spine, no cron)
`weekly_consistency` + `user_game_profile` (streak fields). Kept-week streak + 0–100 score +
rolling 4-wk avg computed lazily on read; the chain calendar on `/progress`. No daily chain, no
freezes yet. *Start here — best health story, lightest deps, establishes the shared primitives.*

### Phase 2 — XP, Levels, Achievements (write-time engine)
`xp_events`, profile XP/level/title, `user_achievements` + `achievement_progress`, `prEvents`.
~8 launch achievements. Single toast in the Logger; `/achievements` + `/profile`. No PII, no graph.

### Phase 3 — Leaderboards (self-relative + adherence only)
`leaderboard_scores`; two boards (Consistency % capped, Volume-PR Count); global + experience
scope; `RANK() OVER` at read; opt-in + honor pledge; hide boards below a participant floor.

### Phase 4 — Cron: freezes, seasons, reminders, challenges
Vercel Cron → authenticated route. Week-close finalization (freezes + grace), quarterly seasons +
prestige, schedule-aware reminders (training-day + streak-at-risk only, quiet hours, dedupe), the
recurring weekly challenge + resolver, nightly cache reconcile.

### Phase 5 — Social (last and gated)
`follows`/`blocks` (friends = mutual), `activity_events` (reusing sessions + prEvents), kudos,
friends-only feed, reports + soft-delete moderation. Groups/coach dashboards as a sub-phase.
Separately: opt-in DOTS strength board with verification tiers + bodyweight/sex collection.
**Do not ship until dated sessions, the privacy model, moderation, AND tests are all in place.**

---

## Dependency rules (don't violate these)
- **Nothing date-based ships before `workout_sessions` exists and is backfilled.**
- **Streaks → Achievements/XP → Leaderboards → Social**, strictly in that order (each reuses the
  prior's primitives; social is the highest abuse/privacy/health-harm surface).
- **Social, public leaderboards, and body-metrics require the age-gate + privacy/consent layer
  live first.**
- Bodyweight-relative public ranking and progress photos are **quarantined** behind an explicit
  ED-safety review — they are not in the default path.
