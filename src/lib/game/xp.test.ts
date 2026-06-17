import { describe, it, expect } from "vitest";
import { setCompletionXp, logQualityXp, classifyPr, XP, PR_MAX_GAIN_PCT } from "./xp";

describe("XP calculators", () => {
  it("only completed, prescribed sets earn completion XP (extra sets pay 0)", () => {
    expect(setCompletionXp(true, true)).toBe(XP.prescribedSet);
    expect(setCompletionXp(true, false)).toBe(0); // beyond prescription
    expect(setCompletionXp(false, true)).toBe(0); // not completed
  });

  it("log-quality is flat — never scales with weight or reps", () => {
    const light = logQualityXp({ completed: true, weight: 20, reps: 5, rpe: 7 });
    const heavy = logQualityXp({ completed: true, weight: 300, reps: 20, rpe: 9 });
    expect(light).toBe(heavy);
    expect(light).toBe(XP.fullLog + XP.rpeLog);
    expect(logQualityXp({ completed: true, weight: 50, reps: 5, rpe: null })).toBe(XP.fullLog);
    expect(logQualityXp({ completed: false, weight: 50, reps: 5, rpe: 7 })).toBe(0);
    expect(logQualityXp({ completed: true, weight: 50, reps: 5, rpe: 2 })).toBe(XP.fullLog); // rpe out of band
  });

  it("classifyPr: first set is a baseline (no reward)", () => {
    expect(classifyPr({ e1rm: 100, priorBest: null, cooldownOk: true })).toEqual({ kind: "first", e1rm: 100 });
  });

  it("classifyPr: plausible improvement rewards; implausible jump records but doesn't", () => {
    const ok = classifyPr({ e1rm: 105, priorBest: 100, cooldownOk: true });
    expect(ok).toMatchObject({ kind: "pr", reward: true });
    const tooBig = classifyPr({ e1rm: 100 * (1 + (PR_MAX_GAIN_PCT + 5) / 100), priorBest: 100, cooldownOk: true });
    expect(tooBig).toMatchObject({ kind: "pr", reward: false });
    const noImprovement = classifyPr({ e1rm: 99, priorBest: 100, cooldownOk: true });
    expect(noImprovement).toEqual({ kind: "none" });
  });
});
