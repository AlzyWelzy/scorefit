import { pgTable, uuid, text, integer, real, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";

// Users. Shaped to be Auth.js-adapter-compatible (id/email/emailVerified/name/image)
// so adding OAuth later is a config change, not a migration rewrite.
// passwordHash is null for users that would later sign in via OAuth only.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  passwordHash: text("password_hash"),
  // Preferred weight unit for the logger / progress / plate calculator.
  unit: text("unit").notNull().default("kg"), // "kg" | "lb"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Short-lived hashed tokens for email verification (OTP) and password reset.
// We store a SHA-256 hash of the code, never the code itself, so a DB leak
// can't be used to verify/reset. One active token per (user, purpose).
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // "email_verify" | "password_reset"
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
    id: uuid("id").primaryKey().defaultRandom(),
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

export type User = typeof users.$inferSelect;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type NewWorkoutLog = typeof workoutLogs.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
