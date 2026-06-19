import { describe, it, expect } from "vitest";
import { computeStreak } from "./streak";

const TODAY = "2026-06-17"; // Wed; current week starts Mon 2026-06-15

describe("streak freezes (frozenWeekStarts)", () => {
  it("a frozen week counts as kept even with zero days", () => {
    // Prior week 2026-06-08 has NO sessions → normally breaks; frozen → bridges it.
    const dates = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-15", "2026-06-16", "2026-06-17"];
    const noFreeze = computeStreak(dates, TODAY);
    expect(noFreeze.currentStreak).toBe(1); // 06-08 empty week broke it
    const withFreeze = computeStreak(dates, TODAY, undefined, new Set(), new Set(["2026-06-08"]));
    expect(withFreeze.currentStreak).toBe(3); // 06-01, 06-08(frozen), 06-15 all kept
  });

  it("a frozen week renders score 100", () => {
    // Include an earlier session so the week sequence spans the frozen 06-08 week.
    const s = computeStreak(
      ["2026-06-01", "2026-06-15", "2026-06-16", "2026-06-17"],
      TODAY,
      undefined,
      new Set(),
      new Set(["2026-06-08"]),
    );
    expect(s.weeks.find((w) => w.weekStart === "2026-06-08")?.score).toBe(100);
  });
});
