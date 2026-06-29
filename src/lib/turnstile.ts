import "server-only";

/**
 * Verify a Cloudflare Turnstile token server-side. Returns true when verification passes
 * OR when Turnstile isn't configured (no secret → feature off, so dev/CI aren't blocked).
 * Fails OPEN on a network error to Cloudflare (the IP rate limiter is the backstop) but
 * fails CLOSED on a definitive rejection or a missing token when the secret IS set.
 */
export async function verifyTurnstile(token: string | undefined | null, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = (await res.json().catch(() => ({ success: false }))) as { success?: boolean };
    return !!data.success;
  } catch {
    return true; // Cloudflare unreachable → don't brick signups; rate limiting still applies
  }
}
