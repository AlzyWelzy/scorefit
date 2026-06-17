import { z } from "zod";

// Hard requirements — the app cannot run without these.
const required = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

/**
 * Validate environment at startup (called from instrumentation.ts). Throws fast with
 * a clear message on missing hard requirements; warns (doesn't crash) on
 * recommended-but-missing production config so misconfiguration is visible early
 * instead of failing deep in a request.
 */
export function assertEnv(): void {
  const parsed = required.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`[env] invalid environment:\n${msg}`);
  }
  if (process.env.NODE_ENV === "production") {
    const warn: string[] = [];
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      warn.push("UPSTASH_REDIS_REST_URL/_TOKEN — rate limiting is in-memory/per-instance (bypassable on serverless) without it");
    }
    if (!process.env.SMTP_HOST) warn.push("SMTP_* — transactional email (verification, 2FA, reminders) will fail");
    if (!process.env.CRON_SECRET) warn.push("CRON_SECRET — scheduled jobs (streak freezes, seasons, reminders) are unprotected/disabled");
    if (warn.length) console.warn("[env] production is missing recommended config:\n  - " + warn.join("\n  - "));
  }
}
