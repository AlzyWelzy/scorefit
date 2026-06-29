import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";

export type SecurityEventKind =
  | "password_changed"
  | "2fa_enabled"
  | "2fa_disabled"
  | "backup_codes_regenerated"
  | "email_changed"
  | "signed_out_all";

/** Append a security-history event. Best-effort — never throws into the caller, since the
 *  security action itself (password change, etc.) must succeed regardless of logging. */
export async function logSecurityEvent(
  userId: string,
  kind: SecurityEventKind,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(securityEvents).values({ userId, kind, meta: meta ?? null });
  } catch {
    // history logging must never block the security action it records
  }
}

export type SecurityEventRow = {
  id: string;
  kind: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

export async function listSecurityEvents(userId: string, limit = 50): Promise<SecurityEventRow[]> {
  return db
    .select({ id: securityEvents.id, kind: securityEvents.kind, meta: securityEvents.meta, createdAt: securityEvents.createdAt })
    .from(securityEvents)
    .where(eq(securityEvents.userId, userId))
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);
}
