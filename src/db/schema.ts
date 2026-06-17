import { pgTable, uuid, text, integer, real, boolean, timestamp, date, unique, index } from "drizzle-orm/pg-core";
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
