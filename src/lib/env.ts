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
 *
 * In production, Upstash is treated as a HARD requirement: distributed rate limiting
 * is the foundation every anti-abuse path (register/login/2FA/leaderboard writes)
 * leans on, and the in-memory fallback is per-instance — bypassable on serverless.
 * We do NOT enforce it during `next build` (NEXT_PHASE = phase-production-build),
 * where runtime secrets are typically absent; the check fires when the server boots.
 */
export function assertEnv(): void {
  const parsed = required.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`[env] invalid environment:\n${msg}`);
  }

  const isProd = process.env.NODE_ENV === "production";
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (isProd && !isBuildPhase) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error(
        "[env] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in " +
          "production — distributed rate limiting backs all anti-abuse paths and the " +
          "in-memory fallback is per-instance (bypassable on serverless). Set them, " +
          "or run with NODE_ENV != production for local/in-memory use.",
      );
    }
  }

  if (isProd) {
    const warn: string[] = [];
    if (!process.env.SMTP_HOST) warn.push("SMTP_* — transactional email (verification, 2FA, reminders) will fail");
    if (!process.env.CRON_SECRET) warn.push("CRON_SECRET — scheduled jobs (streak freezes, seasons, reminders) are unprotected/disabled");
    if (warn.length) console.warn("[env] production is missing recommended config:\n  - " + warn.join("\n  - "));
  }
}
