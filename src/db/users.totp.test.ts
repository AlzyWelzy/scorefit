import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// Integration test for the single-use TOTP step compare-and-swap. The atomic
// "only the first presentation of a step advances the floor" guarantee lives in the
// UPDATE … WHERE predicate, so it can't be exercised by the pure totp unit tests — it
// needs a real database. We use PGlite (real Postgres semantics, in-process, no Docker
// or Neon). Mocking @/db both points advanceTotpStep at PGlite AND stops
// src/db/index.ts from demanding DATABASE_URL at import. `server-only` is stubbed so
// @/db/users can be imported under the node test runtime.
const h = vi.hoisted(() => ({ db: undefined as unknown as PgliteDatabase }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  get db() {
    return h.db;
  },
}));

import { advanceTotpStep } from "@/db/users";

let client: import("@electric-sql/pglite").PGlite;

const UID = "11111111-1111-1111-1111-111111111111";

beforeAll(async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  client = new PGlite();
  h.db = drizzle(client);
  // Just the columns advanceTotpStep reads/writes.
  await client.exec(`CREATE TABLE users (id uuid PRIMARY KEY, last_totp_step integer);`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec(`DELETE FROM users;`);
  await client.exec(`INSERT INTO users (id, last_totp_step) VALUES ('${UID}', NULL);`);
});

describe("advanceTotpStep — single-use TOTP step CAS (integration, PGlite)", () => {
  it("accepts the first use of a step and rejects a replay of the same step", async () => {
    const step = 56_700_123;
    expect(await advanceTotpStep(UID, step)).toBe(true); // first use advances the floor
    expect(await advanceTotpStep(UID, step)).toBe(false); // replay: predicate matches no row
  });

  it("rejects an older step (drift-window replay) but accepts a newer one", async () => {
    expect(await advanceTotpStep(UID, 100)).toBe(true);
    expect(await advanceTotpStep(UID, 99)).toBe(false); // an earlier-window code can't be reused
    expect(await advanceTotpStep(UID, 101)).toBe(true); // the next window is fine
  });

  it("admits exactly one of two presentations of the same step (atomic CAS predicate)", async () => {
    const step = 424_242;
    const results = await Promise.all([advanceTotpStep(UID, step), advanceTotpStep(UID, step)]);
    // Only the first UPDATE matches the predicate; the second sees the advanced floor.
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("returns false for an unknown user (no row to advance)", async () => {
    expect(await advanceTotpStep("22222222-2222-2222-2222-222222222222", 5)).toBe(false);
  });
});
