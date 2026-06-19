import "server-only";
import { createHash, randomBytes } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, backupCodes } from "@/db/schema";

export type TwoFactorMethod = "email" | "totp";

const hash = (code: string) => createHash("sha256").update(code.toUpperCase().replace(/\s|-/g, "")).digest("hex");

// ---- account-level 2FA state ------------------------------------------
export async function setTotpSecret(userId: string, encryptedSecret: string): Promise<void> {
  // Reset the single-use step floor: a freshly enrolled secret must start clean
  // so its first valid codes aren't rejected by a previous secret's high step.
  await db.update(users).set({ totpSecret: encryptedSecret, lastTotpStep: null }).where(eq(users.id, userId));
}

export async function enableTwoFactor(userId: string, method: TwoFactorMethod): Promise<void> {
  await db
    .update(users)
    .set({ twoFactorEnabled: true, twoFactorMethod: method })
    .where(eq(users.id, userId));
}

export async function disableTwoFactor(userId: string): Promise<void> {
  // Bump tokenVersion: disabling 2FA is a security-lowering change, so propagate the
  // existing eventual-revocation path to invalidate sibling sessions.
  await db
    .update(users)
    .set({
      twoFactorEnabled: false,
      twoFactorMethod: null,
      totpSecret: null,
      lastTotpStep: null,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(eq(users.id, userId));
  await db.delete(backupCodes).where(eq(backupCodes.userId, userId));
}

export async function setTwoFactorMethod(userId: string, method: TwoFactorMethod): Promise<void> {
  await db.update(users).set({ twoFactorMethod: method }).where(eq(users.id, userId));
}

// ---- backup codes ------------------------------------------------------
/** Generate N human-friendly backup codes, store their hashes, return the plaintext. */
export async function generateBackupCodes(userId: string, count = 10): Promise<string[]> {
  const codes = Array.from({ length: count }, () => {
    // 8 hex chars, grouped as XXXX-XXXX for readability.
    const raw = randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
  // Regenerating backup codes invalidates the old set and is a credential-rotating
  // action, so bump tokenVersion to propagate the eventual-revocation path to sibling
  // sessions — matching disableTwoFactor / password change. Done in one transaction.
  await db.transaction(async (tx) => {
    await tx.delete(backupCodes).where(eq(backupCodes.userId, userId));
    await tx.insert(backupCodes).values(codes.map((c) => ({ userId, codeHash: hash(c) })));
    await tx
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  });
  return codes;
}

export async function countBackupCodes(userId: string): Promise<number> {
  const rows = await db.select({ id: backupCodes.id }).from(backupCodes).where(eq(backupCodes.userId, userId));
  return rows.length;
}

/** Consume a backup code if it matches an unused one. Returns true on success. */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const h = hash(code);
  const rows = await db
    .select({ id: backupCodes.id })
    .from(backupCodes)
    .where(and(eq(backupCodes.userId, userId), eq(backupCodes.codeHash, h)))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  await db.delete(backupCodes).where(eq(backupCodes.id, row.id));
  return true;
}
