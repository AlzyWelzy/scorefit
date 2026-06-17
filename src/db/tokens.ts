import "server-only";
import { createHash, randomInt } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { verificationTokens } from "@/db/schema";

export type TokenPurpose = "email_verify" | "email_change" | "password_reset" | "two_factor";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

/** Cryptographically-random 6-digit numeric OTP. */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Create (or replace) the active token for a user+purpose and return the
 * plaintext code to email. Only the SHA-256 hash is stored.
 */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db
    .insert(verificationTokens)
    .values({ userId, purpose, codeHash: hash(code), expiresAt, attempts: 0 })
    .onConflictDoUpdate({
      target: [verificationTokens.userId, verificationTokens.purpose],
      set: { codeHash: hash(code), expiresAt, attempts: 0, createdAt: new Date() },
    });
  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_token" | "expired" | "too_many_attempts" | "mismatch" };

/**
 * Verify a submitted code. On success the token is consumed (deleted). On a
 * wrong code we increment attempts and lock the token after MAX_ATTEMPTS.
 */
export async function verifyToken(
  userId: string,
  purpose: TokenPurpose,
  code: string,
): Promise<VerifyResult> {
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.purpose, purpose)))
    .limit(1);
  const token = rows[0];
  if (!token) return { ok: false, reason: "no_token" };

  if (token.expiresAt.getTime() <= Date.now()) {
    await consumeToken(userId, purpose);
    return { ok: false, reason: "expired" };
  }
  if (token.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }
  if (token.codeHash !== hash(code)) {
    // Increment atomically in SQL (attempts = attempts + 1) rather than writing
    // back the value we read — otherwise N concurrent wrong guesses all read the
    // same count and advance the counter by 1, defeating the MAX_ATTEMPTS lock.
    await db
      .update(verificationTokens)
      .set({ attempts: sql`${verificationTokens.attempts} + 1` })
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.purpose, purpose)));
    return { ok: false, reason: "mismatch" };
  }
  await consumeToken(userId, purpose);
  return { ok: true };
}

export async function consumeToken(userId: string, purpose: TokenPurpose): Promise<void> {
  await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.purpose, purpose)));
}
