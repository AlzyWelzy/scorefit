import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Stateless, short-lived signed proof that "this person passed the password
// step for user X". Issued after a correct password when 2FA is required, then
// presented (with a 2FA code) to complete sign-in. HMAC-signed with AUTH_SECRET
// so it can't be forged; never contains the password or the TOTP secret.

const TTL_MS = 5 * 60 * 1000; // 5 minutes to complete the second factor

export const PENDING_2FA_COOKIE = "scorefit_pending_2fa";

function key(): Buffer {
  const s = process.env.AUTH_SECRET ?? "";
  if (!s) throw new Error("AUTH_SECRET required");
  return Buffer.from(s);
}

export type Pending2fa = { userId: string; method: "email" | "totp"; exp: number };

export function signPending(userId: string, method: "email" | "totp"): string {
  const payload: Pending2fa = { userId, method, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPending(token: string | undefined | null): Pending2fa | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Pending2fa;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
