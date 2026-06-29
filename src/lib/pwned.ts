import "server-only";
import { createHash } from "crypto";

/**
 * Check a password against Have I Been Pwned's k-anonymity range API: SHA-1 the password,
 * send only the first 5 hex chars of the hash, and look for the matching suffix in the
 * response. The full hash never leaves the server. Fails OPEN (returns false) on any
 * network/timeout/error so a HIBP outage can never block signups or password resets.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return false;
    const text = await res.text();
    for (const line of text.split("\n")) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix && Number(countStr) > 0) return true;
    }
    return false;
  } catch {
    return false; // fail open — never block auth on a HIBP hiccup
  }
}
