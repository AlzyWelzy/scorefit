import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";

export type NotificationPrefs = { reminders: boolean; digest: boolean; social: boolean };

const DEFAULTS: NotificationPrefs = { reminders: true, digest: true, social: true };

/** A user's notification prefs, with defaults-on when no row exists yet. */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const [row] = await db
    .select({
      reminders: notificationPreferences.reminders,
      digest: notificationPreferences.digest,
      social: notificationPreferences.social,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return row ?? DEFAULTS;
}

/** Upsert the user's prefs (only the provided channels change). */
export async function setNotificationPrefs(userId: string, prefs: Partial<NotificationPrefs>): Promise<void> {
  await db
    .insert(notificationPreferences)
    .values({ userId, ...DEFAULTS, ...prefs, updatedAt: new Date() })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...prefs, updatedAt: new Date() } });
}
