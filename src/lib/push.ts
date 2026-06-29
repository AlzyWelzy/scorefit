import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

let configured: boolean | null = null;

// VAPID keys are optional: when unset, every push call is a silent no-op (like Sentry).
// Generate a pair with `npx web-push generate-vapid-keys`.
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:no-reply@scorefit.net", pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };

/** Send a push to all of a user's subscriptions (best-effort). No-op without VAPID keys.
 *  Prunes subscriptions the push service reports as gone (404/410). */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return;
  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint)).catch(() => {});
        }
      }
    }),
  );
}
