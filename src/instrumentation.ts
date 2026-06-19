// Next.js runs register() once at server startup. Validate env here so
// misconfiguration fails fast (or warns) instead of surfacing deep in a request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("@/lib/env");
    assertEnv();
  }
}
