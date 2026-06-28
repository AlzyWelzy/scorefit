import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// logOutbox.ts is a "use client" module: it touches window/localStorage/navigator
// and fetch. Vitest runs under the `node` environment (vitest.config.ts), so we
// install a minimal in-memory localStorage and a `window`/`navigator` stub here —
// no jsdom needed — to exercise the dedupe logic against the REAL implementation
// (no reimplementation, no source edits).

import { outboxKey, saveSet, pendingCount, flushOutbox, type SetPayload } from "./logOutbox";

const OUTBOX_KEY = "scorefit.outbox.v1";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

let storage: ReturnType<typeof memoryStorage>;

function base(over: Partial<SetPayload> = {}): SetPayload {
  return {
    program: "beginner",
    week: 1,
    daySlug: "push",
    exerciseSlug: "bench-press",
    setIndex: 0,
    weight: 60,
    reps: 5,
    rpe: 8,
    completed: true,
    loggedAt: "2026-06-28T10:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  // The module reads `typeof window === "undefined"` to gate storage access, and
  // `navigator.onLine` to decide whether to POST. window must be present.
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() });
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("outboxKey (keyOf) — dedupe key shape", () => {
  it("encodes all five set coordinates, in order", () => {
    const p = base({ program: "ppl", week: 3, daySlug: "legs", exerciseSlug: "squat", setIndex: 2 });
    expect(outboxKey(p)).toBe("ppl|3|legs|squat|2");
  });

  it("is identical for the same coordinate regardless of payload VALUES", () => {
    // Same coordinate, different weight/reps/rpe/completed/loggedAt → same key.
    // (This is what lets a re-edit of the same set overwrite rather than duplicate.)
    const a = base({ weight: 60, reps: 5, completed: false, loggedAt: "2026-06-28T10:00:00Z" });
    const b = base({ weight: 80, reps: 8, completed: true, loggedAt: "2026-06-28T11:30:00Z" });
    expect(outboxKey(a)).toBe(outboxKey(b));
  });

  it("is collision-free across each distinct coordinate field", () => {
    const ref = outboxKey(base());
    const variants = [
      base({ program: "ppl" }),
      base({ week: 2 }),
      base({ daySlug: "pull" }),
      base({ exerciseSlug: "ohp" }),
      base({ setIndex: 1 }),
    ];
    const keys = variants.map(outboxKey);
    // Every variant differs from the reference...
    for (const k of keys) expect(k).not.toBe(ref);
    // ...and from each other (no two coordinates map to one key).
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not let adjacent fields collide via the delimiter", () => {
    // Guard against "a|1|..." vs "a1|..." style ambiguity at the boundaries.
    const k1 = outboxKey(base({ program: "a", week: 1 }));
    const k2 = outboxKey(base({ program: "a1", week: 0, daySlug: base().daySlug }));
    expect(k1).not.toBe(k2);
  });
});

describe("dedupe — same coordinate never queues twice", () => {
  it("two saves of the same set keep exactly ONE outbox entry (the latest)", async () => {
    // Offline so saveSet persists without POSTing — isolates the dedupe behavior.
    (navigator as { onLine: boolean }).onLine = false;
    const states: [string, string][] = [];
    const onState = (k: string, s: string) => states.push([k, s]);

    const first = base({ weight: 60 });
    const second = base({ weight: 65 }); // same coordinate, newer value

    await saveSet(first, onState);
    expect(pendingCount()).toBe(1);

    await saveSet(second, onState);
    // Still ONE entry — the key collapses the two writes.
    expect(pendingCount()).toBe(1);

    const stored = JSON.parse(storage.getItem(OUTBOX_KEY)!) as Record<string, SetPayload>;
    const key = outboxKey(second);
    expect(Object.keys(stored)).toEqual([key]);
    // The latest value won (overwrite, not append).
    expect(stored[key]!.weight).toBe(65);
  });

  it("distinct coordinates each get their own entry", async () => {
    (navigator as { onLine: boolean }).onLine = false;
    const onState = vi.fn();
    await saveSet(base({ setIndex: 0 }), onState);
    await saveSet(base({ setIndex: 1 }), onState);
    await saveSet(base({ exerciseSlug: "ohp", setIndex: 0 }), onState);
    expect(pendingCount()).toBe(3);
  });

  it("a successful POST clears the entry; a failed POST keeps it queued", async () => {
    (navigator as { onLine: boolean }).onLine = true;

    // 1) Successful save → entry is removed from the outbox.
    const okFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ game: null }),
    });
    vi.stubGlobal("fetch", okFetch);

    await saveSet(base({ setIndex: 0 }), vi.fn());
    expect(pendingCount()).toBe(0);
    expect(okFetch).toHaveBeenCalledOnce();

    // 2) Failed save (5xx) → entry stays queued for retry, no duplicate.
    const badFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null });
    vi.stubGlobal("fetch", badFetch);

    await saveSet(base({ setIndex: 1 }), vi.fn());
    expect(pendingCount()).toBe(1);
    // Re-saving the SAME failed coordinate must not create a second entry.
    await saveSet(base({ setIndex: 1, weight: 70 }), vi.fn());
    expect(pendingCount()).toBe(1);
  });

  it("flushOutbox sends each queued entry once and drains them", async () => {
    (navigator as { onLine: boolean }).onLine = false;
    // Queue two distinct sets offline.
    await saveSet(base({ setIndex: 0 }), vi.fn());
    await saveSet(base({ setIndex: 1 }), vi.fn());
    expect(pendingCount()).toBe(2);

    // Come back online; every POST succeeds.
    (navigator as { onLine: boolean }).onLine = true;
    const okFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ game: null }),
    });
    vi.stubGlobal("fetch", okFetch);

    const sent = await flushOutbox(vi.fn());
    expect(sent).toBe(2);
    expect(okFetch).toHaveBeenCalledTimes(2);
    expect(pendingCount()).toBe(0);
  });
});
