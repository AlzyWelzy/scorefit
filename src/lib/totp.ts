import "server-only";
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
} from "crypto";

// RFC-6238 TOTP (SHA-1, 6 digits, 30s step) implemented with Node crypto — no
// external dependency. Secrets are base32-encoded and stored AES-256-GCM
// encrypted at rest (key from AUTH_SECRET).

const STEP = 30;
const DIGITS = 6;
const WINDOW = 1; // accept ±1 step for clock drift

// ---- base32 (RFC 4648, no padding) -------------------------------------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate a new random base32 TOTP secret. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20)); // 160-bit
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Current TOTP code for a secret (for tests/debug). */
export function totpNow(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 1000 / STEP));
}

/**
 * Verify a submitted TOTP code within the drift window. Returns the matched step
 * counter (so callers can enforce single-use by rejecting codes whose step is
 * not newer than the last accepted one), or null if no candidate matches.
 */
export function verifyTotp(secret: string, code: string, atMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = Math.floor(atMs / 1000 / STEP);
  for (let w = -WINDOW; w <= WINDOW; w++) {
    const step = counter + w;
    const expected = hotp(secret, step);
    const a = Buffer.from(expected);
    const b = Buffer.from(code);
    if (a.length === b.length && timingSafeEqual(a, b)) return step;
  }
  return null;
}

/** otpauth:// URI for QR provisioning. */
export function otpauthUri(secret: string, account: string, issuer = "ScoreFit"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---- AES-256-GCM encryption for the secret at rest ---------------------
// The encryption key is domain-separated from AUTH_SECRET (which also signs the
// session JWT and the pending-2FA HMAC) via HKDF, so the TOTP-encryption key is
// cryptographically distinct from the signing key. Ciphertext is versioned
// ("v2.iv.enc.tag"); legacy "iv.enc.tag" blobs remain decryptable via the old
// SHA-256 key and are migrated to v2 only when the user re-enrolls (the v1 key
// separation is not applied retroactively to existing secrets).
const KEY_INFO = "scorefit:totp-secret:v2";

function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret) throw new Error("AUTH_SECRET is required to encrypt TOTP secrets");
  return secret;
}

// v2: HKDF-SHA256 with a domain-separation label.
function encryptionKeyV2(): Buffer {
  return Buffer.from(hkdfSync("sha256", authSecret(), Buffer.alloc(0), KEY_INFO, 32));
}

// v1 (legacy): single unsalted SHA-256 — decrypt-only, for pre-rotation blobs.
function encryptionKeyV1(): Buffer {
  return createHash("sha256").update(authSecret()).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKeyV2(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${iv.toString("base64")}.${enc.toString("base64")}.${tag.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  const isV2 = parts[0] === "v2";
  const [ivB64, encB64, tagB64] = isV2 ? parts.slice(1) : parts;
  if (!ivB64 || !encB64 || !tagB64) throw new Error("Malformed encrypted secret");
  const key = isV2 ? encryptionKeyV2() : encryptionKeyV1();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
}
