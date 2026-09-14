import { describe, expect, it } from "vitest";

import { addMoney, compareMoney, normalizeDatabaseMoney, percentOfTotal, subtractMoney, sumMoney } from "./money";

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

describe("addMoney", () => {
  it("adds two decimal strings exactly, never via JS floating point", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30"); // the other classic float trap
    expect(addMoney("999.00", "1.00")).toBe("1000.00");
  });
});

describe("sumMoney", () => {
  it("sums a list of same-currency decimal strings exactly", () => {
    expect(sumMoney(["10.00", "20.00", "0.01"])).toBe("30.01");
  });

  it("returns 0.00 for an empty list", () => {
    expect(sumMoney([])).toBe("0.00");
  });
});

describe("compareMoney", () => {
  it("orders exactly, never via Number() (which loses precision on large amounts)", () => {
    expect(compareMoney("10.00", "9.50")).toBeGreaterThan(0);
    expect(compareMoney("9.50", "10.00")).toBeLessThan(0);
    expect(compareMoney("10.00", "10.00")).toBe(0);
    // Beyond what a naive float subtraction can be trusted to compare exactly.
    expect(compareMoney("99999999999.99", "99999999999.98")).toBeGreaterThan(0);
  });

  it("sorts a row list descending by exact amount", () => {
    const rows = ["5.00", "0.10", "0.20", "100.00"];
    expect([...rows].sort((a, b) => compareMoney(b, a))).toEqual(["100.00", "5.00", "0.20", "0.10"]);
  });
});

describe("percentOfTotal", () => {
  it("returns 0 when the total is zero, never dividing by zero", () => {
    expect(percentOfTotal("0.00", "0.00")).toBe(0);
  });

  it("gives a single category exactly 100%", () => {
    expect(percentOfTotal("30.00", "30.00")).toBe(100);
  });

  it("derives the denominator from an exact cent sum — the classic 0.10 + 0.20 float trap sums to exactly 0.30, not 0.30000000000000004", () => {
    const total = sumMoney(["0.10", "0.20"]);
    expect(total).toBe("0.30");
    expect(percentOfTotal("0.10", total)).toBeCloseTo(33.3, 5);
    expect(percentOfTotal("0.20", total)).toBeCloseTo(66.7, 5);
  });

  it("splits multiple categories against an exact total and rounds to one decimal place", () => {
    const amounts = ["50.00", "30.00", "20.00"];
    const total = sumMoney(amounts);
    expect(total).toBe("100.00");
    expect(amounts.map((a) => percentOfTotal(a, total))).toEqual([50, 30, 20]);
  });

  it("stays exact for large amounts well beyond safe float division precision", () => {
    const total = sumMoney(["99999999999.99", "0.01"]);
    expect(total).toBe("100000000000.00");
    expect(percentOfTotal("0.01", total)).toBeCloseTo(0, 5);
    expect(percentOfTotal("99999999999.99", total)).toBeCloseTo(100, 5);
  });
});
