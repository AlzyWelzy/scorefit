import { pgTable, uuid, text, integer, real, boolean, timestamp, date, jsonb, unique, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { newId } from "../lib/ids";

// Every `id` is a ULID rendered into a native Postgres `uuid` column (16-byte,
// natively indexed) and generated app-side via newId() — see src/lib/ids.ts.
// ULIDs are time-ordered, so primary keys sort by creation and inserts stay
// local in the index. There is no DB-side DEFAULT; ids are minted by Drizzle's
// $defaultFn on insert, so all writes must go through the ORM (they do).

// Users. Shaped to be Auth.js-adapter-compatible (id/email/emailVerified/name/image)
// so adding OAuth later is a config change, not a migration rewrite.
// passwordHash is null for users that would later sign in via OAuth only.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  passwordHash: text("password_hash"),
  // Preferred weight unit for the logger / progress / plate calculator.
  unit: text("unit").notNull().default("kg"), // "kg" | "lb"
  // Two-factor auth. Method is the user's chosen second factor; the TOTP
  // secret is stored encrypted (AES-256-GCM) and only present for method=totp.
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorMethod: text("two_factor_method", { enum: ["email", "totp"] }),
  totpSecret: text("totp_secret"), // encrypted base32 secret, null unless TOTP configured
  // Highest TOTP step already accepted — lets verification reject replay of a
  // code within its ±1-step drift window (each code becomes single-use).
  lastTotpStep: integer("last_totp_step"),
  // Bumped on every password change/reset; the JWT carries the version it was
  // minted with, so a bump invalidates all existing sessions (forces re-auth).
  tokenVersion: integer("token_version").notNull().default(0),
  // Address awaiting verification during an email change. The current (verified)
  // email is kept until the new address is confirmed via an emailed code.
  pendingEmail: text("pending_email"),
  // Gamification foundation. timezone (IANA) buckets sessions/streaks into the
  // user's LOCAL calendar; weekStartsOn anchors the training week (1=Mon);
  // goalSessionsPerWeek is an optional flexible target that overrides the
  // program-prescribed session count when set.
  timezone: text("timezone").notNull().default("UTC"),
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  goalSessionsPerWeek: integer("goal_sessions_per_week"),
  // Hard "disable all gamification" switch (ethics/anti-compulsion). When true the
  // write-time engine is skipped (no XP/PR/achievement/streak mechanics fire) and the
  // gamified surfaces hide; opting out also forces the user off the leaderboards.
  // Default false = gamification on, matching the product's motivational design.
  gamificationOptOut: boolean("gamification_opt_out").notNull().default(false),
  // Minimal PII for the (opt-in, gated) leaderboards: birth YEAR only (age gate +
  // age cohort, never full DOB), a public vanity handle distinct from the auth name,
  // an explicit opt-in (default off), and a consent timestamp. No board surfaces a
  // user until leaderboardOptIn is true AND the feature flag is enabled.
  birthYear: integer("birth_year"),
  displayName: text("display_name"),
  leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  // Moderation foundation (cheap upfront, expensive to retrofit — built before social
  // ships). isAdmin gates the /admin review queue. suspendedSocialAt soft-suspends
  // PUBLIC/social privileges only (leaderboards, and later feed/follows) — never the
  // private training account, which a user can always keep using and exporting.
  isAdmin: boolean("is_admin").notNull().default(false),
  suspendedSocialAt: timestamp("suspended_social_at", { withTimezone: true }),
  // "Where you are" — the program/week the logger and TodayCard default to, plus when
  // the user started, so the app resumes where they left off instead of always week 1.
  currentProgram: text("current_program", { enum: ["beginner", "intermediate"] }),
  currentWeek: integer("current_week"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  // Per-user feature-flag allowlist for staged rollout (e.g. ["leaderboards","social"]).
  // Empty/absent = only the global env flags apply.
  featureAllowlist: jsonb("feature_allowlist").$type<string[]>(),
  // Reminder frequency cap: last lapse-reminder email sent, so the cron never nudges the
  // same user more than once per cooldown window (quiet-hours respected via timezone).
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  // Social privacy (Phase 5): three-tier visibility for the feed/profile, default the
  // most private. sharingPaused is a global kill switch the user can flip to stop ALL of
  // their activity from appearing anywhere without changing their tier.
  profileVisibility: text("profile_visibility", { enum: ["private", "friends", "public"] })
    .notNull()
    .default("friends"),
  sharingPaused: boolean("sharing_paused").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One-time backup codes for 2FA recovery. Each row is a SHA-256 hash of a code;
// rows are deleted as they are consumed.
export const backupCodes = pgTable(
  "backup_codes",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_backup_user").on(t.userId)],
);

// Short-lived hashed tokens for email verification (OTP) and password reset.
// We store a SHA-256 hash of the code, never the code itself, so a DB leak
// can't be used to verify/reset. One active token per (user, purpose).
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // "email_verify" | "password_reset" | "two_factor"
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_token_user_purpose").on(t.userId, t.purpose)],
);

// One row per logged working set. Uniqueness on the prescription coordinates
// means writes upsert rather than duplicate.
export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    program: text("program", { enum: ["beginner", "intermediate"] }).notNull(),
    week: integer("week").notNull(),
    daySlug: text("day_slug").notNull(),
    exerciseSlug: text("exercise_slug").notNull(),
    setIndex: integer("set_index").notNull(), // 1-based working set number
    weight: real("weight"), // actual load used (unit-agnostic; user's choice)
    reps: integer("reps"),
    rpe: real("rpe"),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_log_coords").on(t.userId, t.program, t.week, t.daySlug, t.exerciseSlug, t.setIndex),
    index("idx_log_user_program_week").on(t.userId, t.program, t.week),
    // Partial index for getPreviousLoads' DISTINCT ON (only completed rows are scanned),
    // ordered to match (exercise, set, latest week, heaviest) so the dedup is index-served.
    index("idx_log_prev_completed")
      .on(t.userId, t.program, t.exerciseSlug, t.setIndex, t.week.desc())
      .where(sql`${t.completed} = true`),
  ],
);

// Derived dated-session projection: one row per training day a user worked, rolled
// up from completed workout_logs on each write. THE date-anchored entity the whole
// gamification layer (streaks, leaderboards, feeds, achievements) reads from instead
// of scanning the mutable workout_logs.updatedAt. sessionDate is the user's LOCAL
// date, FROZEN on first write (later edits never move it). qualifies marks the
// honesty floor so a single stray tap can't bank a day. Keyed by the program-day
// (matching how logs are coordinate-keyed); sessionDate is the calendar stamp.
export const workoutSessions = pgTable(
  "workout_sessions",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    program: text("program", { enum: ["beginner", "intermediate"] }).notNull(),
    week: integer("week").notNull(),
    daySlug: text("day_slug").notNull(),
    sessionDate: date("session_date", { mode: "string" }).notNull(), // user-local, frozen on first write
    distinctExercises: integer("distinct_exercises").notNull().default(0),
    completedSets: integer("completed_sets").notNull().default(0),
    prescribedSets: integer("prescribed_sets").notNull().default(0),
    tonnage: real("tonnage").notNull().default(0), // Σ completed weight×reps
    bestE1rm: real("best_e1rm"), // best Epley e1RM in the session, null if none gradeable
    qualifies: boolean("qualifies").notNull().default(false), // ≥3 sets OR ≥2 distinct exercises
    committedAt: timestamp("committed_at", { withTimezone: true }), // set when the user taps "finish"
    backfilled: boolean("backfilled").notNull().default(false), // synthesized from history, date is approximate
    firstAt: timestamp("first_at", { withTimezone: true }),
    lastAt: timestamp("last_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_session_coords").on(t.userId, t.program, t.week, t.daySlug),
    index("idx_session_user_date").on(t.userId, t.sessionDate),
  ],
);

export type User = typeof users.$inferSelect;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type NewWorkoutLog = typeof workoutLogs.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type BackupCode = typeof backupCodes.$inferSelect;

// ─── Gamification: XP, levels & achievements (Phase 2) ───────────────────────
// All driven by one write-time engine (evaluateGameEvents, src/db/game.ts) hooked
// into the set-log write path. Caches below are fully recomputable from xp_events
// + the logs, so drift is recoverable.

// One denormalized per-user game summary. O(1) reads for /profile and headers.
export const userGameProfile = pgTable("user_game_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  totalXp: integer("total_xp").notNull().default(0), // = SUM(xp_events.amount)
  level: integer("level").notNull().default(1),
  title: text("title").notNull().default("Novice"),
  // exerciseSlug → best Epley e1RM + the date it was set, for O(1) PR detection
  // and the per-exercise PR cooldown. In the user's own weight unit (unit-agnostic).
  bestE1rm: jsonb("best_e1rm")
    .$type<Record<string, { e1rm: number; at: string }>>()
    .notNull()
    .default({}),
  // Phase 4 (cron). Streak freezes are scarce/non-stockpiling (earned 1 per 4 kept weeks,
  // capped at 2) and auto-applied at week-close to bridge a single missed week. Seasons
  // reset competitive XP quarterly while lifetime totalXp/level persist; prestige is an
  // opt-in cosmetic re-prestige. All default to off/zero and are written only by cron.
  freezesAvailable: integer("freezes_available").notNull().default(0),
  freezeKeptWeeks: integer("freeze_kept_weeks").notNull().default(0), // kept weeks since last freeze earned
  // Week-starts (Mon, YYYY-MM-DD) a freeze has been applied to — those weeks count as kept.
  frozenWeeks: jsonb("frozen_weeks").$type<string[]>().notNull().default([]),
  seasonId: text("season_id"), // e.g. "2026-Q2"; null until the first season opens
  seasonXp: integer("season_xp").notNull().default(0),
  prestige: integer("prestige").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Idempotent, upsertable XP ledger. amount is the CURRENT correct value for a
// (source, refKey) — re-evaluating a set upserts it (0 when un-completed), so
// totalXp = SUM(amount) stays correct with no reversal rows. The unique key is the
// idempotency guard against the offline outbox replaying the same set.
export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source", {
      enum: ["set_completion", "log_quality", "pr", "achievement", "cadence", "perfect_week"],
    }).notNull(),
    refKey: text("ref_key").notNull(), // e.g. a set coordinate, or 'pr:bench:2026-06-17'
    amount: integer("amount").notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(), // = the session's local date
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_xp_event").on(t.userId, t.source, t.refKey),
    index("idx_xp_user_date").on(t.userId, t.eventDate),
  ],
);

// Earned badges. UNIQUE makes the on-write insert idempotent; tier upgrades in place.
export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(), // stable rule slug
    tier: text("tier"), // 'bronze' | 'silver' | 'gold' | null
    evidence: jsonb("evidence"), // snapshot of what triggered it (auditable)
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_user_achievement").on(t.userId, t.achievementId)],
);

// Running counters toward locked/tiered achievements so the engine and the trophy
// room never rescan all logs (progress bars: "11/53", "400 to next landmark").
export const achievementProgress = pgTable(
  "achievement_progress",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // e.g. 'explorer:distinct', 'volume:lifetime'
    progressValue: real("progress_value").notNull().default(0),
    progressMax: real("progress_max"), // next-tier / completion threshold
    meta: jsonb("meta"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_ach_progress").on(t.userId, t.key)],
);

// Append-only personal-record ledger derived from completed sets. Feeds PR XP, the
// e1RM-PR achievement, and (later) a self-relative leaderboard + feed events.
export const prEvents = pgTable(
  "pr_events",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseSlug: text("exercise_slug").notNull(),
    kind: text("kind", { enum: ["e1rm", "volume"] }).notNull(),
    value: real("value").notNull(), // e1RM (user's unit) or volume
    gainPct: real("gain_pct"), // % over prior best
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    flagged: boolean("flagged").notNull().default(false), // implausible jump: recorded, not rewarded
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One PR row per exercise per local day, upserted in lockstep with PR XP so the
    // ledger can't drift from multiple PR sets on the same exercise+date.
    unique("uq_pr_event").on(t.userId, t.exerciseSlug, t.occurredOn, t.kind),
    index("idx_pr_user_ex").on(t.userId, t.exerciseSlug),
  ],
);

// Moderation queue. Content-type-agnostic (targetType + targetId) so the social
// surfaces shipping later — display names, feed captions, activity events — plug in
// without a schema change. reporterId cascades on the reporter's deletion; reportedUserId
// is captured for context and SET NULL if that account is later removed (a report
// survives the reported account's deletion for audit). status drives the admin queue.
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: uuid("reported_user_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type", { enum: ["user", "display_name", "activity_event", "caption"] }).notNull(),
    targetId: text("target_id").notNull(), // id/slug of the reported thing (e.g. the reported user's id)
    reason: text("reason", { enum: ["spam", "harassment", "inappropriate", "impersonation", "other"] }).notNull(),
    detail: text("detail"), // optional free-text context (≤500 chars, enforced at the API)
    status: text("status", { enum: ["open", "actioned", "dismissed"] }).notNull().default("open"),
    resolvedByAdminId: uuid("resolved_by_admin_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_reports_status").on(t.status),
    index("idx_reports_reporter").on(t.reporterId),
  ],
);

// Append-only audit trail of privileged admin actions (moderation, user management,
// content takedowns). Read on /admin/audit. Never updated or deleted — the record is the
// point. adminId is nullable + ON DELETE SET NULL so deleting an admin keeps the history.
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // e.g. "report.actioned", "user.suspend", "user.delete"
    targetType: text("target_type"), // "report" | "user" | "activity_event" | …
    targetId: text("target_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_audit_created").on(t.createdAt)],
);

// Per-user security history (credential changes, 2FA toggles, email changes). Shown on
// /account/security so users can spot anything they didn't do. Append-only.
export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // password_changed | 2fa_enabled | 2fa_disabled | backup_codes_regenerated | email_changed
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_security_user").on(t.userId, t.createdAt)],
);

// Per-user notification channel preferences. One row per user (created on first change);
// absence means "all defaults on". Every send path must check these before emailing.
export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  reminders: boolean("reminders").notNull().default(true), // lapse / streak-at-risk nudges
  digest: boolean("digest").notNull().default(true), // weekly progress digest
  social: boolean("social").notNull().default(true), // follows / kudos / group invites
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Bodyweight / body-measurement tracking (P4). One row per user per local day; the
// weight is stored in the user's current unit (converted on a unit switch like logs).
// Deliberately minimal — bodyweight only — and NEVER fed into any leaderboard, XP, or
// public surface (see ED_SAFETY_REVIEW.md): it's a private trend on /progress only.
export const bodyMetrics = pgTable(
  "body_metrics",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    measuredOn: date("measured_on", { mode: "string" }).notNull(), // user-local day
    weight: real("weight").notNull(), // in the user's unit at time of entry
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_body_metric_day").on(t.userId, t.measuredOn)],
);

// Exercise substitutions chosen by the user (P4). One row per (user, program, daySlug,
// originalSlug); the logger/progress/prevLoads follow the chosen sub so history tracks
// the movement actually trained. Null subSlug means "reset to original" (we just delete).
export const exerciseSwaps = pgTable(
  "exercise_swaps",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    program: text("program", { enum: ["beginner", "intermediate"] }).notNull(),
    daySlug: text("day_slug").notNull(),
    originalSlug: text("original_slug").notNull(),
    subSlug: text("sub_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_swap").on(t.userId, t.program, t.daySlug, t.originalSlug)],
);

// ─── Social (Phase 5) — all behind SOCIAL_ENABLED, default OFF ───────────────

// Asymmetric follow graph. "Friends" = a mutual follow (derived, no separate table).
export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_follow").on(t.followerId, t.followeeId),
    index("idx_follow_followee").on(t.followeeId),
  ],
);

// Hard block — overrides everything (no follow, no feed visibility, no kudos).
export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_block").on(t.blockerId, t.blockedId)],
);

// System-generated activity events — NOT free text (keeps moderation tractable). One
// row per noteworthy thing a user did; the feed reads followees' recent events.
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["session_completed", "e1rm_pr", "streak_milestone", "program_completed", "achievement"],
    }).notNull(),
    // Structured payload for rendering (e.g. { exercise, e1rm } or { weeks }). Never free text.
    data: jsonb("data").$type<Record<string, unknown>>(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    // Soft-delete for moderation (admin "action" on a report); hidden events drop out
    // of every feed but stay for audit.
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_activity_user").on(t.userId, t.createdAt),
    // Feed read path: filter by author + not-hidden, order by recency.
    index("idx_activity_feed").on(t.userId, t.hiddenAt, t.createdAt),
    // Idempotency: at most one event of a kind per user per day (re-saves don't duplicate).
    unique("uq_activity").on(t.userId, t.kind, t.occurredOn),
  ],
);

// Single kudos reaction per user per event (the only reaction type for now).
export const reactions = pgTable(
  "reactions",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => activityEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_reaction").on(t.eventId, t.userId),
    index("idx_reaction_event").on(t.eventId),
  ],
);

// Opt-in comments on activity events (Phase 5). Bounded length; soft-deletable via the
// report path (hiddenAt). Author + event both cascade on deletion.
export const eventComments = pgTable(
  "event_comments",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    eventId: uuid("event_id")
      .notNull()
      .references(() => activityEvents.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(), // ≤280 chars, enforced at the API
    hiddenAt: timestamp("hidden_at", { withTimezone: true }), // soft-delete (moderation)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_comment_event").on(t.eventId, t.createdAt)],
);

// ─── Groups / clubs (Phase 5 sub-phase) ──────────────────────────────────────

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["crew", "coaching"] }).notNull().default("crew"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_group_owner").on(t.ownerId)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "coach", "member"] }).notNull().default("member"),
    // Coaching dashboards see member training ONLY with explicit, revocable consent.
    sharesTrainingWithCoach: boolean("shares_training_with_coach").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_group_member").on(t.groupId, t.userId), index("idx_member_user").on(t.userId)],
);

// ─── Challenges (Phase 4) ─────────────────────────────────────────────────────

// One row per challenge instance. kind drives scoring; frozen finalScore at resolution
// so later log edits can't flip a settled result. Personal challenges have no group.
export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    kind: text("kind", {
      enum: ["weekly_consistency", "program_completion", "group_attendance", "duel"],
    }).notNull(),
    title: text("title").notNull(),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_challenge_ends").on(t.endsOn)],
);

export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    finalScore: integer("final_score"), // frozen at resolution; null while live
    finalRank: integer("final_rank"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_challenge_participant").on(t.challengeId, t.userId)],
);

export type UserGameProfile = typeof userGameProfile.$inferSelect;
export type XpEvent = typeof xpEvents.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type AchievementProgressRow = typeof achievementProgress.$inferSelect;
export type PrEvent = typeof prEvents.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type ExerciseSwap = typeof exerciseSwaps.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;
export type EventComment = typeof eventComments.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
