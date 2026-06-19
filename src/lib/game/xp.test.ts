import { describe, it, expect } from "vitest";
import { setCompletionXp, setCompletionXpDecayed, logQualityXp, classifyPr, prCooldownOk, applyDailyCap, autoRegulateLoad, XP, PR_MAX_GAIN_PCT, PR_COOLDOWN_DAYS, DAILY_SOFT_CAP, DAILY_HARD_CAP, JUNK_DECAY } from "./xp";

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

  it("prCooldownOk: first PR for an exercise always earns (no prior paid dates)", () => {
    expect(prCooldownOk([], "2026-06-18")).toBe(true);
  });

  it("prCooldownOk: a paid PR inside the prior window blocks a repeat", () => {
    // PR_COOLDOWN_DAYS=7: a PR 3 days ago is within the window → blocked.
    expect(prCooldownOk(["2026-06-15"], "2026-06-18")).toBe(false);
    // Exactly PR_COOLDOWN_DAYS apart is outside the (strict) window → earns again.
    const earlier = "2026-06-11"; // 7 days before 2026-06-18
    expect(PR_COOLDOWN_DAYS).toBe(7);
    expect(prCooldownOk([earlier], "2026-06-18")).toBe(true);
    // Well past the window → earns again.
    expect(prCooldownOk(["2026-06-01"], "2026-06-18")).toBe(true);
  });

  it("prCooldownOk: only earlier dates gate; a later/same date never blocks", () => {
    expect(prCooldownOk(["2026-06-18"], "2026-06-18")).toBe(true); // same day (its own row)
    expect(prCooldownOk(["2026-06-20"], "2026-06-18")).toBe(true); // a future paid PR
  });

  it("prCooldownOk: blocks if ANY prior paid date falls in the window", () => {
    expect(prCooldownOk(["2026-06-01", "2026-06-17"], "2026-06-18")).toBe(false);
    expect(prCooldownOk(["2026-06-01", "2026-06-05"], "2026-06-18")).toBe(true);
  });

  it("applyDailyCap: passes through under the soft cap", () => {
    expect(applyDailyCap(0)).toBe(0);
    expect(applyDailyCap(130)).toBe(130);
    expect(applyDailyCap(DAILY_SOFT_CAP)).toBe(DAILY_SOFT_CAP);
  });

  it("applyDailyCap: quarter-rate between soft and hard cap, then flat at the ceiling", () => {
    // 40 over the soft cap → 40 * 0.25 = 10 extra.
    expect(applyDailyCap(DAILY_SOFT_CAP + 40)).toBe(DAILY_SOFT_CAP + 10);
    // At/above the hard cap, the over-portion is clamped to (hard - soft) first.
    const ceiling = DAILY_SOFT_CAP + Math.round((DAILY_HARD_CAP - DAILY_SOFT_CAP) * 0.25);
    expect(applyDailyCap(DAILY_HARD_CAP)).toBe(ceiling);
    expect(applyDailyCap(DAILY_HARD_CAP + 10_000)).toBe(ceiling);
  });

  it("setCompletionXpDecayed: prescribed sets pay full, extras decay 3→1→0", () => {
    const base = { completed: true, isPrescribed: true, prescribedCount: 3 };
    expect(setCompletionXpDecayed({ ...base, position: 1 })).toBe(XP.prescribedSet);
    expect(setCompletionXpDecayed({ ...base, position: 3 })).toBe(XP.prescribedSet);
    expect(setCompletionXpDecayed({ ...base, position: 4 })).toBe(JUNK_DECAY[0]); // 3
    expect(setCompletionXpDecayed({ ...base, position: 5 })).toBe(JUNK_DECAY[1]); // 1
    expect(setCompletionXpDecayed({ ...base, position: 6 })).toBe(0);
    expect(setCompletionXpDecayed({ ...base, position: 99 })).toBe(0);
    // not completed / not prescribed → 0
    expect(setCompletionXpDecayed({ ...base, completed: false, position: 1 })).toBe(0);
    expect(setCompletionXpDecayed({ ...base, isPrescribed: false, position: 1 })).toBe(0);
  });

  it("autoRegulateLoad: heavier when last RPE under target, lighter when over, rounded", () => {
    // Easier than target (rpe 7 vs target 9) → suggest heavier.
    const up = autoRegulateLoad({ lastWeight: 100, lastRpe: 7, targetRpe: 9, rounding: 2.5 });
    expect(up.direction).toBe("up");
    expect(up.suggestedWeight).toBeGreaterThan(100);
    // Harder than target → lighter.
    const down = autoRegulateLoad({ lastWeight: 100, lastRpe: 10, targetRpe: 8, rounding: 2.5 });
    expect(down.direction).toBe("down");
    // On target → hold (within rounding).
    const hold = autoRegulateLoad({ lastWeight: 100, lastRpe: 9, targetRpe: 9 });
    expect(hold.direction).toBe("hold");
    // Rounded to the increment.
    expect(up.suggestedWeight % 2.5).toBe(0);
  });
});
