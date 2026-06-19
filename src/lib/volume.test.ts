import { describe, it, expect } from "vitest";
import { weeklyMuscleVolume, zoneFor, muscleFor, LANDMARKS } from "./volume";

describe("per-muscle volume landmarks", () => {
  it("zoneFor classifies against MEV/MAV/MRV", () => {
    const l = { mev: 8, mav: 16, mrv: 22 };
    expect(zoneFor(4, l)).toBe("below");
    expect(zoneFor(8, l)).toBe("productive");
    expect(zoneFor(16, l)).toBe("productive");
    expect(zoneFor(20, l)).toBe("high");
    expect(zoneFor(25, l)).toBe("over");
  });

  it("muscleFor maps names to muscle groups", () => {
    expect(muscleFor("Barbell Bench Press")).toBe("chest");
    expect(muscleFor("Lat Pulldown")).toBe("back");
    expect(muscleFor("Lateral Raise")).toBe("shoulders");
    expect(muscleFor("Bayesian Cable Curl")).toBe("biceps");
    expect(muscleFor("Romanian Deadlift")).toBe("hamstrings");
  });

  it("weeklyMuscleVolume aggregates and sorts by sets desc", () => {
    const rows = weeklyMuscleVolume([
      { name: "Barbell Bench Press" },
      { name: "Barbell Bench Press" },
      { name: "Incline Dumbbell Press" },
      { name: "Lat Pulldown" },
    ]);
    expect(rows[0]?.muscle).toBe("chest");
    expect(rows[0]?.sets).toBe(3);
    expect(rows.find((r) => r.muscle === "back")?.sets).toBe(1);
    // chest landmark present
    expect(rows[0]?.landmark).toEqual(LANDMARKS.chest);
  });
});
