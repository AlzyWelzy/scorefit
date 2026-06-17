import { describe, it, expect } from "vitest";
import { computeStreak } from "./streak";

const TODAY = "2026-06-17"; // Wednesday; week starts Mon 2026-06-15

describe("computeStreak (target 3, Monday-anchored)", () => {
  it("3 distinct days this week → kept, streak 1", () => {
    const s = computeStreak(["2026-06-15", "2026-06-16", "2026-06-17"], TODAY);
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(1);
  });

  it("the in-progress current week never breaks the streak", () => {
    // prior week kept, current week empty so far
    const s = computeStreak(["2026-06-08", "2026-06-09", "2026-06-10"], TODAY);
    expect(s.currentStreak).toBe(1);
  });

  it("a gap week breaks the streak", () => {
    const s = computeStreak(
      ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-15", "2026-06-16", "2026-06-17"],
      TODAY,
    );
    expect(s.currentStreak).toBe(1); // the 06-08 week is empty → break
    expect(s.longestStreak).toBe(1);
  });

  it("two consecutive kept weeks → streak 2", () => {
    const s = computeStreak(
      ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-15", "2026-06-16", "2026-06-17"],
      TODAY,
    );
    expect(s.currentStreak).toBe(2);
  });

  it("under target is not kept; logging the same day twice doesn't count twice", () => {
    expect(computeStreak(["2026-06-15", "2026-06-16"], TODAY).currentStreak).toBe(0);
    // duplicate dates collapse to one distinct day
    expect(computeStreak(["2026-06-15", "2026-06-15", "2026-06-15"], TODAY).weeks.at(-1)?.days).toBe(1);
  });

  it("no sessions → zeros, but still renders one current-week cell", () => {
    const s = computeStreak([], TODAY);
    expect(s.currentStreak).toBe(0);
    expect(s.weeks.length).toBe(1);
    expect(s.weeks[0]?.isCurrent).toBe(true);
  });
});
