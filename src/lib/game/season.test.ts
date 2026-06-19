import { describe, it, expect } from "vitest";
import { currentSeasonId } from "./season";

describe("currentSeasonId (quarterly)", () => {
  it("maps a date to its calendar quarter", () => {
    expect(currentSeasonId("2026-01-15")).toBe("2026-Q1");
    expect(currentSeasonId("2026-03-31")).toBe("2026-Q1");
    expect(currentSeasonId("2026-04-01")).toBe("2026-Q2");
    expect(currentSeasonId("2026-06-17")).toBe("2026-Q2");
    expect(currentSeasonId("2026-09-30")).toBe("2026-Q3");
    expect(currentSeasonId("2026-12-31")).toBe("2026-Q4");
  });
});
