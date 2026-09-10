import { describe, expect, it } from "vitest";

import { normalizeDatabaseMoney, subtractMoney } from "./money";

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

describe("subtractMoney", () => {
  it("subtracts two decimal strings exactly, never via JS floating point", () => {
    // A classic float trap (0.30000000000000004) — exact via integer cents.
    expect(subtractMoney("0.30", "0.10")).toBe("0.20");
    expect(subtractMoney("1000.00", "1.00")).toBe("999.00");
  });

  it("produces a negative result without clamping", () => {
    expect(subtractMoney("100.00", "150.50")).toBe("-50.50");
  });

  it("handles whole numbers and already-negative operands", () => {
    expect(subtractMoney("50", "20")).toBe("30.00");
    expect(subtractMoney("-10.00", "5.00")).toBe("-15.00");
  });
});
