import { vi, describe, it, expect } from "vitest";

// src/lib/totp.ts begins with `import "server-only"`, a Next.js build-time guard
// that is not a real installable module (it has no node resolution). Under Vitest's
// `node` environment it would throw MODULE_NOT_FOUND, so we stub it to an empty
// module. This lets us exercise the REAL TOTP implementation (no reimplementation)
// without touching any source file. Everything below is pure crypto math — no DB,
// no network.
vi.mock("server-only", () => ({}));

import { totpNow, verifyTotp, generateTotpSecret, otpauthUri } from "./totp";

// RFC-6238 constants mirrored from totp.ts for readable timestep math.
const STEP_S = 30;
const STEP_MS = STEP_S * 1000;

// A fixed secret so generation is deterministic across runs.
const SECRET = "JBSWY3DPEHPK3PXP"; // valid base32

describe("totpNow — code generation determinism", () => {
  it("is deterministic for a given secret + timestep", () => {
    const at = 1_700_000_000_000; // fixed instant
    const a = totpNow(SECRET, at);
    const b = totpNow(SECRET, at);
    expect(a).toBe(b);
    // Any instant inside the SAME 30s step yields the same code.
    const stepStart = Math.floor(at / STEP_MS) * STEP_MS;
    expect(totpNow(SECRET, stepStart)).toBe(a);
    expect(totpNow(SECRET, stepStart + STEP_MS - 1)).toBe(a);
  });

  it("emits exactly 6 numeric digits", () => {
    const code = totpNow(SECRET, 1_700_000_000_000);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("rolls to a different code in the next step (single-use surface)", () => {
    const stepStart = Math.floor(1_700_000_000_000 / STEP_MS) * STEP_MS;
    const thisStep = totpNow(SECRET, stepStart);
    const nextStep = totpNow(SECRET, stepStart + STEP_MS);
    // Different counters almost always produce different codes; a defensive check
    // that the timestep actually advances the HOTP counter.
    expect(nextStep).not.toBe(thisStep);
  });

  it("differs per secret for the same instant", () => {
    const other = "GEZDGNBVGY3TQOJQ"; // different valid base32
    const at = 1_700_000_000_000;
    expect(totpNow(SECRET, at)).not.toBe(totpNow(other, at));
  });
});

describe("verifyTotp — drift window + step derivation", () => {
  it("accepts the current code and returns the matched step counter", () => {
    const at = 1_700_000_000_000;
    const counter = Math.floor(at / STEP_MS);
    const code = totpNow(SECRET, at);
    expect(verifyTotp(SECRET, code, at)).toBe(counter);
  });

  it("accepts a code from ±1 step (clock drift tolerance)", () => {
    const at = 1_700_000_000_000;
    const counter = Math.floor(at / STEP_MS);
    // Code minted one step in the past, verified "now" → accepted, returns prev step.
    const prevCode = totpNow(SECRET, at - STEP_MS);
    expect(verifyTotp(SECRET, prevCode, at)).toBe(counter - 1);
    // Code minted one step in the future, verified "now" → accepted, returns next step.
    const nextCode = totpNow(SECRET, at + STEP_MS);
    expect(verifyTotp(SECRET, nextCode, at)).toBe(counter + 1);
  });

  it("rejects a code outside the ±1 step window", () => {
    const at = 1_700_000_000_000;
    // 2 steps in the past / future is beyond WINDOW=1 → rejected.
    const tooOld = totpNow(SECRET, at - 2 * STEP_MS);
    const tooNew = totpNow(SECRET, at + 2 * STEP_MS);
    expect(verifyTotp(SECRET, tooOld, at)).toBeNull();
    expect(verifyTotp(SECRET, tooNew, at)).toBeNull();
  });

  it("rejects a wrong code, and malformed inputs, without throwing", () => {
    const at = 1_700_000_000_000;
    const real = totpNow(SECRET, at);
    // Flip the code to something that is valid-format but wrong.
    const wrong = real === "000000" ? "111111" : "000000";
    expect(verifyTotp(SECRET, wrong, at)).toBeNull();
    // Non-6-digit inputs are rejected by the format guard.
    expect(verifyTotp(SECRET, "12345", at)).toBeNull(); // too short
    expect(verifyTotp(SECRET, "1234567", at)).toBeNull(); // too long
    expect(verifyTotp(SECRET, "abcdef", at)).toBeNull(); // non-numeric
    expect(verifyTotp(SECRET, "", at)).toBeNull();
  });

  it("the returned step is monotonic across time — the basis for single-use", () => {
    // verifyTotp returns the matched step counter so the DB layer can reject any
    // code whose step is not strictly newer than the last accepted one. Here we show
    // the counter increases as the clock advances by a step.
    const at = 1_700_000_000_000;
    const s0 = verifyTotp(SECRET, totpNow(SECRET, at), at);
    const s1 = verifyTotp(SECRET, totpNow(SECRET, at + STEP_MS), at + STEP_MS);
    expect(s0).not.toBeNull();
    expect(s1).not.toBeNull();
    expect((s1 as number) - (s0 as number)).toBe(1);
  });
});

describe("generateTotpSecret", () => {
  it("produces a non-trivial base32 secret usable by the verifier", () => {
    const secret = generateTotpSecret();
    // 160-bit random → 32 base32 chars, alphabet RFC-4648 (no padding).
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(32);
    // Round-trips through generate/verify.
    const at = 1_700_000_000_000;
    expect(verifyTotp(secret, totpNow(secret, at), at)).not.toBeNull();
  });

  it("is random — two secrets differ", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("otpauthUri", () => {
  it("embeds the secret and RFC-6238 params for QR provisioning", () => {
    const uri = otpauthUri(SECRET, "user@example.com");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(`secret=${SECRET}`);
    expect(uri).toContain("issuer=ScoreFit");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
    // Label is URI-encoded "issuer:account".
    expect(uri).toContain(encodeURIComponent("ScoreFit:user@example.com"));
  });
});

// ---------------------------------------------------------------------------
// SINGLE-USE / REPLAY PROTECTION — NEEDS AN INTEGRATION TEST.
//
// The single-use guarantee does NOT live in totp.ts. verifyTotp here is
// idempotent: presenting the same valid code twice within its window returns the
// same step counter both times (proven below). Replay is prevented one layer up
// by advanceTotpStep() in src/db/users.ts, which does a compare-and-swap in a
// single SQL UPDATE:
//
//   UPDATE users SET last_totp_step = $step
//   WHERE id = $id AND (last_totp_step IS NULL OR last_totp_step < $step)
//   RETURNING id;            // returns true only if a row was updated
//
// Two concurrent logins presenting the same code resolve to the same step; only
// the first UPDATE matches the predicate and advances the floor — the second
// matches no row and is rejected as a replay. That atomic CAS cannot be unit
// tested without a real (or transactional) Postgres; it belongs in an integration
// test that exercises advanceTotpStep against a DB. The assertion below documents
// exactly why the pure layer alone is insufficient.
// ---------------------------------------------------------------------------
describe("replay protection scope", () => {
  it("verifyTotp alone does NOT prevent reuse (idempotent) — DB CAS is required", () => {
    const at = 1_700_000_000_000;
    const code = totpNow(SECRET, at);
    const first = verifyTotp(SECRET, code, at);
    const second = verifyTotp(SECRET, code, at);
    // Same code, same step, both succeed → the pure layer cannot block a replay.
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it.todo(
    "advanceTotpStep CAS rejects a replayed step (integration test — needs Postgres)",
  );
});
