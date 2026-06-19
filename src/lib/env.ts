import { z } from "zod";

// Hard requirements — the app cannot run without these.
const required = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

/**
 * Validate environment at startup (called from instrumentation.ts). Throws fast ONLY on
 * the two genuinely-fatal requirements (DATABASE_URL, AUTH_SECRET) — without those the
 * app truly cannot serve a request. Everything else WARNS loudly but never crashes the
 * server, because a crashed auth server (no logins at all) is strictly worse than the
 * thing the missing config would have prevented.
 *
 * Upstash (distributed rate limiting) is STRONGLY recommended in production — without it
 * the limiter degrades to per-instance/in-memory (bypassable on serverless). But it is
 * enforced as a hard boot requirement ONLY when REQUIRE_UPSTASH=true is explicitly set,
 * so a deploy that simply forgot to configure it degrades gracefully instead of bricking
 * login on every cold start. (This is the fix for "login fails / try again after a while":
 * idle serverless instances cold-start, and a hard-fail here took down auth entirely.)
 */
export function assertEnv(): void {
  const parsed = required.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`[env] invalid environment:\n${msg}`);
  }

  const isProd = process.env.NODE_ENV === "production";
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (!isProd || isBuildPhase) return;

  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  // Opt-in hard enforcement for operators who want a fail-closed posture.
  if (!hasUpstash && process.env.REQUIRE_UPSTASH === "true") {
    throw new Error(
      "[env] REQUIRE_UPSTASH=true but UPSTASH_REDIS_REST_URL/_TOKEN are missing. " +
        "Set them, or unset REQUIRE_UPSTASH to allow the in-memory fallback.",
    );
  }

  const warn: string[] = [];
  if (!hasUpstash) {
    warn.push(
      "UPSTASH_REDIS_REST_URL/_TOKEN — STRONGLY recommended in production; without it " +
        "rate limiting is per-instance/in-memory (bypassable on serverless). Set REQUIRE_UPSTASH=true to enforce.",
    );
  }
  if (!process.env.SMTP_HOST) warn.push("SMTP_* — transactional email (verification, 2FA, reminders) will fail");
  if (!process.env.CRON_SECRET) warn.push("CRON_SECRET — scheduled jobs (streak freezes, seasons, reminders) are unprotected/disabled");
  if (warn.length) console.warn("[env] production is missing recommended config:\n  - " + warn.join("\n  - "));
}
