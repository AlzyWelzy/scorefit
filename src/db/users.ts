import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

export async function setName(id: string, name: string | null): Promise<void> {
  await db.update(users).set({ name }).where(eq(users.id, id));
}

export async function setEmail(id: string, email: string): Promise<void> {
  // Changing email invalidates verification.
  await db
    .update(users)
    .set({ email: email.toLowerCase(), emailVerified: null })
    .where(eq(users.id, id));
}

/** Stage an email change; the current verified email stays until confirmed. */
export async function setPendingEmail(id: string, email: string | null): Promise<void> {
  await db
    .update(users)
    .set({ pendingEmail: email ? email.toLowerCase() : null })
    .where(eq(users.id, id));
}

/** Apply a confirmed email change: swap in the new address, mark it verified,
 *  clear the pending field, and bump tokenVersion — the login identifier changed,
 *  so all existing sessions must re-authenticate (same as a password change). */
export async function applyPendingEmail(id: string, email: string): Promise<void> {
  await db
    .update(users)
    .set({
      email: email.toLowerCase(),
      emailVerified: new Date(),
      pendingEmail: null,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(eq(users.id, id));
}

/**
 * Atomically advance the single-use TOTP step floor. Returns true only if `step`
 * is newer than the stored value — a compare-and-swap done in one UPDATE so two
 * concurrent logins presenting the same code can't both succeed (only the first
 * advances; the second matches no row and is rejected as a replay).
 */
export async function advanceTotpStep(id: string, step: number): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ lastTotpStep: step })
    .where(and(eq(users.id, id), or(isNull(users.lastTotpStep), lt(users.lastTotpStep, step))))
    .returning({ id: users.id });
  return rows.length > 0;
}

export async function setPasswordHash(id: string, passwordHash: string): Promise<void> {
  // Bumping tokenVersion invalidates every existing JWT session on a password
  // change/reset — other devices (and any hijacked session) must re-authenticate.
  await db
    .update(users)
    .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, id));
}

export async function setUnit(id: string, unit: "kg" | "lb"): Promise<void> {
  await db.update(users).set({ unit }).where(eq(users.id, id));
}

export async function markEmailVerified(id: string): Promise<void> {
  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, id));
}

export async function deleteUser(id: string): Promise<void> {
  // workout_logs + verification_tokens cascade via FK onDelete.
  await db.delete(users).where(eq(users.id, id));
}
