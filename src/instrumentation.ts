// Next.js runs register() once at server startup. Validate env here so
// misconfiguration fails fast (or warns) instead of surfacing deep in a request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("@/lib/env");
    assertEnv();
  }
  // Activate Sentry when a DSN is configured (no-op otherwise) so captureException's
  // dynamic import in src/lib/observability.ts has an initialized client to forward to.
  // Source-map upload via withSentryConfig is optional and left to deploy config.
  if (process.env.SENTRY_DSN && (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge")) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  }
}
