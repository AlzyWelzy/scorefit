// Client-side helper: forward an error caught by a React error boundary to the
// server observability sink (/api/observability), which routes it into
// captureException (structured logs + Sentry when configured). captureException
// itself is server-only, so client crashes must hop through the API. Best-effort:
// never throws, never blocks the error UI, uses keepalive so it survives a reload.
export function reportClientError(
  error: (Error & { digest?: string }) | undefined,
  where: string,
): void {
  try {
    const body = JSON.stringify({
      message: error?.message ?? String(error),
      stack: error?.stack,
      digest: error?.digest,
      where,
    });
    void fetch("/api/observability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let reporting break the error UI.
  }
}
