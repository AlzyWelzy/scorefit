# ScoreFit — Improvements Backlog

A prioritized audit of the codebase across architecture, security, performance, data,
UX, accessibility, SEO, engineering-ops, and product features. Findings are evidence-based
with file references; severity = impact × likelihood, effort is S (<1 day) / M (days) / L (week+).

> **Companion doc:** [GAMIFICATION.md](GAMIFICATION.md) covers the streaks / leaderboards /
> groups build. The two share one critical-path dependency — a dated `workout_sessions`
> table — called out in both.

**Overall verdict:** ScoreFit is well-built. The auth/security layer is unusually mature for
its size (per-user-scoped queries, CSRF via `sameOrigin`, careful 2FA/TOTP, safe-degrading
rate limiting). Most findings are tightening, not rot. The one structural gap that gates the
entire roadmap: workout logs are keyed by `program/week/day` coordinates with no calendar date.

---

## 🔴 P0 — Must-fix before any social/gamified feature

| # | Finding | Evidence | Fix | Effort |
|---|---------|----------|-----|--------|
| 1 | **No calendar-dated session entity.** Logs keyed by prescription coords; only a *mutable* `updatedAt` (editing a W1 set re-stamps it "today"). Cannot answer "what did the user train on date X". Blocks streaks/leaderboards/feeds/achievements. | [src/db/schema.ts:68-90](src/db/schema.ts#L68-L90), [src/app/progress/page.tsx:32-67](src/app/progress/page.tsx#L32-L67) | Add `workout_sessions` (server-derived `sessionDate`, frozen on first write) populated inside `upsertSetLog`. See GAMIFICATION.md Phase 0. | M |
| 2 | **Zero automated tests** across security-sensitive logic: TOTP single-use CAS, JWT revocation ceiling, outbox dedup, `parseSets`/`uniqueDaySlug` coord math. | no `*.test.ts`, no `test` script | Vitest on the pure logic first. CI-gate it. | M |
| 3 | **No CI/CD** — lint/typecheck/build run only locally. | no `.github` | `.github/workflows/ci.yml`: `npm ci` → typecheck/lint/build on PR (Node 20.9 + 24). | S |
| 4 | **No observability** — server errors invisible in prod (only `console.*`, which vanishes on serverless). | [src/app/global-error.tsx](src/app/global-error.tsx) only `console.error` | Sentry via `instrumentation.ts`, wired into error boundaries; forward mailer/rate-limit/job failures. | M |
| 5 | **No `middleware.ts`** — route protection relies solely on per-route `auth()`; the `authorized()` callback is written but dead. | [src/auth.config.ts](src/auth.config.ts) | Add `src/middleware.ts` exporting `auth` with a matcher over `/log,/progress,/account,/api/account/:path*,/api/logs` (exclude `/api/auth`). Keep per-route checks as belt-and-suspenders. | S |
| 6 | **Rate limiting is in-memory/per-instance** unless Upstash is set — bypassable on serverless. *All* anti-abuse leans on it. | [src/lib/rateLimit.ts:83-91](src/lib/rateLimit.ts#L83-L91) | Treat Upstash as **required in production** — fail boot/build without `UPSTASH_*`. The degrade-to-memory-on-Redis-blip fallback is good; the all-memory *default* is the gap. | S |

---

## 🟠 P1 — Security hardening (defense-in-depth)

- **2FA-lowering actions don't revoke sibling sessions.** Bump `users.tokenVersion` inside `disableTwoFactor` and on backup-code regeneration. — [src/db/twoFactor.ts](src/db/twoFactor.ts) · S
- **TOTP-enrollment "begin" endpoint has no re-auth or rate limit.** Add `rateLimit('2fa-begin', \`${ip}:${userId}\`, 5, 10min)`, throttle the email-send branch, consider requiring current password. — [src/app/api/account/2fa/route.ts](src/app/api/account/2fa/route.ts) · S
- **JWT revocation fails open for up to 30 min** during a DB outage (deliberate availability tradeoff). Consider lowering to 5–10 min and emit a metric when fail-open fires. — [src/auth.ts:124-161](src/auth.ts#L124-L161) · S
- **Credentials `code` field is unbounded length.** Constrain to `z.string().max(16)`. · S
- Optional: `timingSafeEqual` on `codeHash` comparison; dispatch verification email out-of-band so latency doesn't leak address existence. · M

---

## 🟠 P1 — Data model & performance

- **`getPreviousLoads` scans all prior completed sets and dedupes in JS** with no supporting index. Push to `DISTINCT ON (exercise_slug, set_index) … ORDER BY … week DESC, weight DESC`; add partial index `WHERE completed = true`. — [src/db/logs.ts:50-82](src/db/logs.ts#L50-L82) · M
- **`/progress` rebuilds the static prescription map and rescans all logs every request** with no caching. Hoist `prescribed`/`validCoords`/`nameBySlug` to a module-level memo keyed by `ProgramId`; wrap `getLogsForProgram` in `cache()`; move tonnage/e1RM into SQL aggregates (`SUM(weight*reps) GROUP BY week`). — [src/app/progress/page.tsx:32-72](src/app/progress/page.tsx#L32-L72) · M
- **kg/lb switch doesn't convert stored or prescribed loads** — silent data corruption of tonnage/e1RM. Store a per-log unit and normalize for display, or convert history on switch; at minimum warn. — [src/db/schema.ts:14](src/db/schema.ts#L14) · M
- **290KB auto-generated `src/data/*.ts` are completely untyped** (`as const`, no `Program`/`Week`/`Exercise` interface), so consumers reverse-engineer shape via regex ([src/lib/movement.ts](src/lib/movement.ts), [src/lib/today.ts](src/lib/today.ts)). Define shared interfaces; have the generator emit `satisfies Program[]`. · M
- **`daySlug` coordinate dedup logic is duplicated** between `/log` and `/progress` — must change in lockstep. Extract `buildWeekCoordinates(program, week)` into [src/lib/data.ts](src/lib/data.ts). · S
- **`getProgram` uses string-literal dispatch** instead of the `PROGRAMS` map. Make it `isProgramId(id) ? PROGRAMS[id] : null`. — [src/lib/data.ts:43-47](src/lib/data.ts#L43-L47) · S
- **JWT callback uses ad-hoc `as` casts**; `next-auth.d.ts` is missing `ver`/`verAt`. Extend the module augmentation, delete the casts. — [src/types/next-auth.d.ts](src/types/next-auth.d.ts) · S
- **Connection pool reuse is dev-only** — cache the postgres client on `globalThis` unconditionally. — [src/db/index.ts:13-15](src/db/index.ts#L13-L15) · S
- `program`/`unit`/`twoFactorMethod` are free text with app-level enums only — add `pgEnum`/CHECK constraints before more write paths exist. · S

---

## 🟡 P2 — UX / in-gym mobile loop (the weakest surface)

- **The app has no memory of where you are** — logger and TodayCard always default to *beginner / week 1*. Add `currentProgram`/`currentWeek` (+ `startedAt`) to users; default `/log`, `/progress`, TodayCard to it; derive a suggested week from elapsed time or furthest-logged week. **(Highest-impact UX fix.)** · M
- **Rest timer & plate calculator are stranded on `/tools`**, away from the logger. Embed a compact rest timer that auto-starts on set completion, and a plate-calc affordance seeded from the entered weight. The **per-exercise rest values already in the data (780+) are completely unused.** · M
- **No discoverable path from a program/week/day into the logger** — the read→do loop is broken. Add "Start / log this day" CTAs deep-linking `/log?program=X&week=Y` and scrolling to the day. · S
- **Logger stacks all 5 days on one scroll** — add a day selector (reuse `DayNav`) defaulting to today's weekday. · S
- **No first-run onboarding** — insert a post-signup "choose program + start week + kg/lb" step (seeds "where you are"). · M
- **RPE input on every set row adds friction** — collapse it behind a tap or surface only on the prescribed top/last set; common-case log should be two taps (weight, reps, ✓). · S

---

## 🟡 P2 — Accessibility (strong baseline, targeted gaps)

- `--color-faint` (#6b747c) **fails WCAG AA** for normal text on bg/surface (3.85–4.09:1) — used on many 10–11px labels. Lighten to ~#7e8893. — [src/app/globals.css:19](src/app/globals.css#L19) · S
- `RegisterForm` error isn't announced (`role="alert"`) — parity with the other auth forms. · S
- `Field` inputs lack `aria-describedby`/`aria-invalid` linkage to hint/error text. · M
- **Progress tonnage bars convey value by width/color only** — add a screen-reader text alternative (mirror the good `role="img"` + summary in `VolumeChart`). · M
- Command-palette focus trap is one-directional — mark background `inert` while open. · M
- Logger completion state is signaled by green border alone — differentiate the icon (filled vs outline check). · S

---

## 🟢 P3 — SEO & discoverability

- **Private/auth pages are crawlable — no `noindex` anywhere.** Add `robots: { index: false, follow: false }` to `/log`, `/progress`, `/account`, and all auth pages; add a `disallow` block in [robots.ts](src/app/robots.ts). **Establish this convention now** so the upcoming social/leaderboard/feed pages inherit it. · S
- **The 53 exercises are your best unrealized organic-search asset** — emit `HowTo`/`ExerciseAction` + a *complete* `VideoObject` (add `uploadDate`) per exercise. Build a shared `lib/structuredData.ts` ld+json helper. · M
- `Article`/`TechArticle` (+ `FAQPage`) on guidebook sections; `BreadcrumbList` on nested pages; `ItemList` on index pages; `SearchAction` + `logo` on the WebSite/Organization node. · S–M
- Add `/tools` to the sitemap; drive `lastModified` from real content provenance. · S

---

## 🟢 P3 — Engineering ops (prerequisites for a multi-user product)

- **Centralized env validation** — one zod-validated `src/lib/env.ts` asserting `DATABASE_URL`, `AUTH_SECRET`, and (in prod) `SMTP_*`/`UPSTASH_*`; fail boot fast. · S
- **Background-job runner** — Vercel Cron → authenticated `/api/cron/*` (secret header) or Upstash QStash. Needed for leaderboard snapshots, streak rollups, reminders, reconciliation. · L
- **Automate `drizzle-kit migrate`** in the deploy pipeline (not `push`); document in README. Schema-drift risk on Vercel today. · S
- **Moderation tooling** designed upfront — `isAdmin` flag, `reports` table, soft-delete/hidden flags, minimal `/admin` route. Cheap upfront, expensive to retrofit. · M
- **Feature flags** — env-driven global kills + a per-user allowlist column for staged social rollout. · S

---

## 🔵 P4 — Non-gamification product features lifters expect

| Feature | Note | Effort |
|---------|------|--------|
| **Bodyweight / measurement tracking** | New `body_metrics` table + trend on `/progress`. Bodyweight alone is one number/day, low-effort, high-retention. | M |
| **Exercise swap UX** | Substitutions are *display-only* today ([exercises/[slug]/page.tsx:118](src/app/exercises/[slug]/page.tsx)). Add a "Swap" control recording the chosen sub so prevLoads/progress follow it. | M |
| **Data export** | `GET /api/logs/export` (CSV/JSON) + download in account/danger zone. Pairs with delete-account. | S |
| **RPE auto-regulation hints** | Suggest next-set load from last weight/reps/RPE vs prescribed RPE target. | M |
| **Per-muscle weekly set volume vs MEV/MAV/MRV** | High credibility for a "science-based" brand; the archetype primitive already exists in [movement.ts](src/lib/movement.ts). | L |
| **Reminders/notifications** | Start with a "you haven't logged in N days" email (mailer already exists); web push later via the existing service worker. | M |
| **Light theme** | Dark-only today; daytime/outdoor gym readability. | M |
| **Schedule/calendar awareness** | Rest-day markers; resume CTA to current week. | M |
| **Wearable / Apple Health / Google Fit** | Gated behind the dated-session entity; `.ics` export of completed sessions is an easy first step. | L |
