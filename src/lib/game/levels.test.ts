import { describe, it, expect } from "vitest";
import { xpForLevel, levelForXp, xpToReach, titleForLevel, levelProgress } from "./levels";

describe("levels", () => {
  it("level 1 starts at 0 XP, advances at the level-1 cost", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(1) - 1)).toBe(1);
    expect(levelForXp(xpForLevel(1))).toBe(2);
  });

  it("levelForXp is consistent with xpToReach for many totals", () => {
    for (let xp = 0; xp < 50_000; xp += 137) {
      const lvl = levelForXp(xp);
      expect(xp).toBeGreaterThanOrEqual(xpToReach(lvl));
      expect(xp).toBeLessThan(xpToReach(lvl + 1));
    }
  });

  it("curve decelerates (each level costs more than the last)", () => {
    for (let n = 1; n < 60; n++) expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
  });

  it("titles are maturity-based and monotonic by level", () => {
    expect(titleForLevel(1)).toBe("Novice");
    expect(titleForLevel(5)).toBe("Consistent");
    expect(titleForLevel(10)).toBe("Disciplined");
    expect(titleForLevel(50)).toBe("Architect");
    expect(titleForLevel(999)).toBe("Architect");
  });

  it("levelProgress: intoLevel + toNext == levelSpan", () => {
    for (const xp of [0, 79, 80, 500, 5000]) {
      const p = levelProgress(xp);
      expect(p.intoLevel + p.toNext).toBe(p.levelSpan);
      expect(p.intoLevel).toBeGreaterThanOrEqual(0);
    }
  });
});
