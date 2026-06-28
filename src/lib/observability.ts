import "server-only";

// Observability seam. Server errors on serverless vanish if they only hit console.*
// in a request that already returned; this gives one place to forward them.
//
// Today it emits STRUCTURED JSON (greppable in Vercel/any log drain) and, when
// SENTRY_DSN is set, also forwards to the (now-installed) `@sentry/nextjs`. The
// import stays dynamic + guarded so a missing DSN means zero Sentry overhead.
// To finish activating Sentry in production:
//   1. set SENTRY_DSN (+ run `npx @sentry/wizard` for source maps, optional)
//   2. add `Sentry.init({ dsn: process.env.SENTRY_DSN })` in instrumentation.ts
// No call sites change — they already go through captureException().

type Extra = Record<string, unknown>;

// Resolved once: the Sentry module if present, else null. Optional dependency, so the
// import is wrapped — a missing package must never break the app.
let sentry: { captureException: (e: unknown, hint?: unknown) => void } | null | undefined;

async function getSentry() {
  if (sentry !== undefined) return sentry;
  if (!process.env.SENTRY_DSN) {
    sentry = null;
    return sentry;
  }
  try {
    const mod = await import("@sentry/nextjs");
    sentry = mod as unknown as { captureException: (e: unknown, hint?: unknown) => void };
  } catch {
    sentry = null;
  }
  return sentry;
}

/**
 * Report a server-side error. Always logs a structured line; forwards to Sentry when
 * configured. Never throws — observability must not become a new failure mode.
 */
export async function captureException(error: unknown, context?: { where?: string; extra?: Extra }): Promise<void> {
  try {
    const payload = {
      level: "error",
      where: context?.where ?? "unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context?.extra,
    };
    console.error("[error]", JSON.stringify(payload));

    const s = await getSentry();
    if (s) s.captureException(error, { extra: { where: context?.where, ...context?.extra } });
  } catch {
    // Last-resort: don't let the reporter itself throw.
  }
}
