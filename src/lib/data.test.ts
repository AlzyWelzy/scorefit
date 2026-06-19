import { describe, it, expect } from "vitest";
import { parseSets, uniqueDaySlug, buildWeekCoordinates, isProgramId, weekCount } from "./data";

describe("parseSets", () => {
  it("parses a positive count, falls back to 1, caps at 12", () => {
    expect(parseSets("3")).toBe(3);
    expect(parseSets(null)).toBe(1);
    expect(parseSets("0")).toBe(1);
    expect(parseSets("99")).toBe(12);
    expect(parseSets("garbage")).toBe(1);
  });
});

describe("uniqueDaySlug", () => {
  it("first occurrence keeps the slug; repeats are suffixed", () => {
    const prior = ["push", "pull", "push", "push"];
    expect(uniqueDaySlug("push", 0, prior)).toBe("push");
    expect(uniqueDaySlug("push", 2, prior)).toBe("push-2");
    expect(uniqueDaySlug("push", 3, prior)).toBe("push-3");
  });
});

describe("buildWeekCoordinates", () => {
  it("produces unique day slugs and one coord key per prescribed set", () => {
    const wc = buildWeekCoordinates("beginner", 1);
    expect(wc.days.length).toBeGreaterThan(0);
    // coordKeys count == prescribedSets, and every key is unique
    expect(wc.coordKeys.size).toBe(wc.prescribedSets);
    const slugs = wc.days.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length); // no slug collisions
    // each exercise has >=1 set
    for (const d of wc.days) for (const ex of d.exercises) expect(ex.sets).toBeGreaterThanOrEqual(1);
  });

  it("unknown program/week yields an empty coordinate space", () => {
    const wc = buildWeekCoordinates("beginner", 999);
    expect(wc.days).toEqual([]);
    expect(wc.prescribedSets).toBe(0);
  });
});

describe("program ids", () => {
  it("recognizes valid ids and reports week counts", () => {
    expect(isProgramId("beginner")).toBe(true);
    expect(isProgramId("nope")).toBe(false);
    expect(weekCount("beginner")).toBeGreaterThan(0);
  });
});
