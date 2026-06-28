import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// WHY THIS TEST REPLICATES THE PREDICATE INSTEAD OF IMPORTING auth.ts
//
// The revocation decision lives INLINE inside the `jwt` callback in src/auth.ts
// (~lines 124-162). It is not exported, and src/auth.ts cannot be imported in a
// unit test: at module load it pulls in next-auth, next/headers (request-scoped),
// bcryptjs, and a LIVE database connection via `@/db` (the dev box even has a
// known Neon/IPv6 hang). The callback also performs a real `await db.select(...)`.
//
// So, exactly as the task allows, the small PURE decision is mirrored here as a
// standalone predicate and the four branches are asserted. Keep this in lockstep
// with src/auth.ts if that logic changes. The original (paraphrased):
//
//   const STALE_MS       = 5 * 60 * 1000;   // re-check cadence
//   const HARD_CEILING_MS = 10 * 60 * 1000; // fail-open ceiling
//   needsRefresh = trigger==="update" || verAt===undefined || now-verAt > STALE_MS
//   if (needsRefresh && sub) {
//     try { fresh = await db.select(...) }
//     catch (dbDown) {                       // infra error → FAIL OPEN, bounded
//       if (verAt !== undefined && now - verAt > HARD_CEILING_MS) return null; // revoke
//       return token;                                                          // keep
//     }
//     if (!fresh[0]) return null;                       // account deleted → revoke
//     if (fresh[0].tokenVersion !== (token.ver ?? 0)) return null; // version bump → revoke
//     // else refresh fields and keep
//   }
//   return token;
// ---------------------------------------------------------------------------

const STALE_MS = 5 * 60 * 1000;
const HARD_CEILING_MS = 10 * 60 * 1000;

type Decision = "keep" | "revoke";
type DbState =
  | { kind: "ok"; row: { tokenVersion: number } | null } // null row = account deleted
  | { kind: "down" }; // infra error (pool/replica hiccup)

/** Pure mirror of the src/auth.ts jwt-callback revocation decision. */
function revocationDecision(args: {
  now: number;
  verAt: number | undefined; // when the token last passed a check
  tokenVer: number | undefined; // version stamped on the token
  trigger?: "update" | "signIn" | "signUp";
  db: DbState;
}): Decision {
  const { now, verAt, tokenVer, trigger, db } = args;

  const needsRefresh =
    trigger === "update" || verAt === undefined || now - verAt > STALE_MS;
  if (!needsRefresh) return "keep"; // inside the cadence — token honored as-is

  if (db.kind === "down") {
    // FAIL OPEN for availability, but bounded by the hard ceiling.
    if (verAt !== undefined && now - verAt > HARD_CEILING_MS) return "revoke";
    return "keep";
  }

  if (db.row === null) return "revoke"; // account deleted
  if (db.row.tokenVersion !== (tokenVer ?? 0)) return "revoke"; // version bumped
  return "keep";
}

describe("JWT revocation decision", () => {
  const now = 1_700_000_000_000;
  const freshVerAt = now - 1000; // 1s ago → inside cadence

  it("tokenVersion equal → KEEP", () => {
    expect(
      revocationDecision({
        now,
        verAt: now - STALE_MS - 1, // force a refresh
        tokenVer: 3,
        db: { kind: "ok", row: { tokenVersion: 3 } },
      }),
    ).toBe("keep");
  });

  it("tokenVersion mismatch → REVOKE", () => {
    expect(
      revocationDecision({
        now,
        verAt: now - STALE_MS - 1,
        tokenVer: 3,
        db: { kind: "ok", row: { tokenVersion: 4 } }, // password/email change bumped it
      }),
    ).toBe("revoke");
  });

  it("legacy token (ver undefined) is compared as 0, so any later bump REVOKES", () => {
    expect(
      revocationDecision({
        now,
        verAt: now - STALE_MS - 1,
        tokenVer: undefined, // pre-migration token
        db: { kind: "ok", row: { tokenVersion: 1 } },
      }),
    ).toBe("revoke");
    // ...but ver undefined vs stored 0 still matches → keep.
    expect(
      revocationDecision({
        now,
        verAt: now - STALE_MS - 1,
        tokenVer: undefined,
        db: { kind: "ok", row: { tokenVersion: 0 } },
      }),
    ).toBe("keep");
  });

  it("account deleted (row gone) → REVOKE", () => {
    expect(
      revocationDecision({
        now,
        verAt: now - STALE_MS - 1,
        tokenVer: 0,
        db: { kind: "ok", row: null },
      }),
    ).toBe("revoke");
  });

  it("DB unavailable WITHIN the hard ceiling → FAIL OPEN (keep)", () => {
    expect(
      revocationDecision({
        now,
        verAt: now - (STALE_MS + 1000), // needs refresh, but only ~5min stale
        tokenVer: 3,
        db: { kind: "down" },
      }),
    ).toBe("keep");
  });

  it("DB unavailable PAST the hard ceiling → REVOKE (bounded fail-open)", () => {
    expect(
      revocationDecision({
        now,
        verAt: now - (HARD_CEILING_MS + 1000), // outage outlived the ceiling
        tokenVer: 3,
        db: { kind: "down" },
      }),
    ).toBe("revoke");
  });

  it("DB unavailable with verAt undefined → KEEP (can't measure the ceiling yet)", () => {
    // A just-minted token whose first check happens during an outage cannot exceed
    // the ceiling (no baseline), so it fails open this cycle and retries next.
    expect(
      revocationDecision({
        now,
        verAt: undefined,
        tokenVer: 3,
        db: { kind: "down" },
      }),
    ).toBe("keep");
  });

  it("inside the stale cadence → KEEP without consulting the DB", () => {
    // Even a 'down' DB is irrelevant here: no refresh is attempted.
    expect(
      revocationDecision({
        now,
        verAt: freshVerAt,
        tokenVer: 3,
        db: { kind: "down" },
      }),
    ).toBe("keep");
  });

  it("trigger='update' forces a refresh even inside the cadence", () => {
    expect(
      revocationDecision({
        now,
        verAt: freshVerAt, // would normally skip the DB read
        tokenVer: 3,
        trigger: "update",
        db: { kind: "ok", row: { tokenVersion: 4 } },
      }),
    ).toBe("revoke");
  });

  it("boundary: exactly STALE_MS old does NOT refresh (strict >)", () => {
    // now - verAt === STALE_MS is not > STALE_MS, so no refresh → keep.
    expect(
      revocationDecision({
        now,
        verAt: now - STALE_MS,
        tokenVer: 3,
        db: { kind: "ok", row: { tokenVersion: 99 } }, // mismatch ignored — never read
      }),
    ).toBe("keep");
  });

  it("boundary: exactly HARD_CEILING_MS old fails open (strict >)", () => {
    // now - verAt === HARD_CEILING_MS is not > HARD_CEILING_MS → still keep.
    expect(
      revocationDecision({
        now,
        verAt: now - HARD_CEILING_MS,
        tokenVer: 3,
        db: { kind: "down" },
      }),
    ).toBe("keep");
  });
});
