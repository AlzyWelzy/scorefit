import "server-only";
import { eq } from "drizzle-orm";
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

export async function setPasswordHash(id: string, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
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
