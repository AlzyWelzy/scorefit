import { describe, it, expect } from "vitest";
import { weekStartOf, addDays, localDateInTz, resolveLocalDate, isValidTimeZone } from "./time";

describe("week math", () => {
  it("every day of a week maps to that week's Monday", () => {
    // 2026-06-15 (Mon) .. 2026-06-21 (Sun)
    for (let d = 15; d <= 21; d++) {
      expect(weekStartOf(`2026-06-${d}`)).toBe("2026-06-15");
    }
    // Sunday must map back, not forward
    expect(weekStartOf("2026-06-14")).toBe("2026-06-08");
  });

  it("addDays handles month/year boundaries", () => {
    expect(addDays("2026-06-15", 7)).toBe("2026-06-22");
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("timezone date bucketing", () => {
  it("a 9pm-Pacific instant stays on the same local day, not UTC tomorrow", () => {
    const at = new Date("2026-06-17T21:00:00-07:00"); // 9pm PDT = 04:00Z next day
    expect(localDateInTz("America/Los_Angeles", at)).toBe("2026-06-17");
    expect(localDateInTz("UTC", at)).toBe("2026-06-18");
  });

  it("invalid tz falls back to UTC", () => {
    const at = new Date("2026-06-17T12:00:00Z");
    expect(localDateInTz("Not/AZone", at)).toBe("2026-06-17");
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
  });

  it("resolveLocalDate clamps an absurd backdated loggedAt", () => {
    const now = Date.now();
    const wayBack = new Date(now - 1000 * 60 * 60 * 24 * 365).toISOString(); // 1y ago
    // clamp floor is 48h, so it can't resolve to a year-old date
    const got = resolveLocalDate("UTC", wayBack);
    const floor = localDateInTz("UTC", new Date(now - 1000 * 60 * 60 * 49));
    expect(got >= floor).toBe(true);
  });
});
