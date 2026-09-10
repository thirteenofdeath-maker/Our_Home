import { describe, expect, it } from "vitest";

import { normalizeDatabaseMoney } from "./money";

describe("normalizeDatabaseMoney", () => {
  it("normalizes PostgREST number values to decimal strings", () => {
    expect(normalizeDatabaseMoney(123.4)).toBe("123.40");
    expect(normalizeDatabaseMoney(-5)).toBe("-5.00");
  });

  it("retains and normalizes string values", () => {
    expect(normalizeDatabaseMoney("123.40")).toBe("123.40");
    expect(normalizeDatabaseMoney("-5")).toBe("-5.00");
  });
});
