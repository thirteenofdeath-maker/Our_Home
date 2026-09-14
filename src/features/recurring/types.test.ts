import { describe, expect, it } from "vitest";

import { formatFinanceDate, frequencyLabel } from "./types";

describe("frequencyLabel", () => {
  it("uses a plain label at interval 1", () => {
    expect(frequencyLabel("WEEKLY", 1)).toBe("ทุกสัปดาห์");
    expect(frequencyLabel("MONTHLY", 1)).toBe("ทุกเดือน");
    expect(frequencyLabel("YEARLY", 1)).toBe("ทุกปี");
  });

  it("includes the interval count when greater than 1", () => {
    expect(frequencyLabel("WEEKLY", 2)).toBe("ทุก 2 สัปดาห์");
    expect(frequencyLabel("MONTHLY", 3)).toBe("ทุก 3 เดือน");
  });
});

describe("formatFinanceDate", () => {
  it("formats a canonical date string as a Thai Bangkok calendar date", () => {
    expect(formatFinanceDate("2026-09-25")).toBe("25 ก.ย. 2569");
  });
});
