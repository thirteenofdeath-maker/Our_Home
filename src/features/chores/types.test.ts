import { describe, expect, it } from "vitest";

import { choreCadenceLabel } from "./types";

describe("choreCadenceLabel", () => {
  it.each([
    ["DAILY", 2, "ทุก 2 วัน"],
    ["WEEKLY", 1, "ทุกสัปดาห์"],
    ["MONTHLY", 3, "ทุก 3 เดือน"],
    ["YEARLY", 1, "ทุกปี"],
  ] as const)("formats %s recurrence", (cadence, interval, expected) => {
    expect(choreCadenceLabel(cadence, interval)).toBe(expected);
  });

  it("uses the anchored weekday and month date for common schedules", () => {
    expect(choreCadenceLabel("WEEKLY", 1, "2026-10-04")).toBe("ทุกวันอาทิตย์");
    expect(choreCadenceLabel("MONTHLY", 1, "2026-10-15")).toBe(
      "ทุกวันที่ 15 ของเดือน",
    );
  });
});
