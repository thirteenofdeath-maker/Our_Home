import { describe, expect, it } from "vitest";

import { greetingForBangkok, homeCoverMode } from "./domain";

describe("Today greeting in Bangkok time", () => {
  it.each([
    ["2026-09-15T23:00:00Z", "สวัสดียามเช้า"],
    ["2026-09-16T02:00:00Z", "สวัสดีตอนสาย"],
    ["2026-09-16T05:00:00Z", "สวัสดีตอนเที่ยง"],
    ["2026-09-16T08:00:00Z", "สวัสดีตอนบ่าย"],
    ["2026-09-16T11:00:00Z", "สวัสดีตอนเย็น"],
    ["2026-09-16T14:00:00Z", "สวัสดีตอนค่ำ"],
    ["2026-09-16T19:00:00Z", "สวัสดีตอนดึก"],
  ])("greets at %s", (iso, expected) => {
    expect(greetingForBangkok(new Date(iso))).toBe(expected);
  });
});

describe("Today cover in Bangkok time", () => {
  it.each([
    ["2026-09-15T21:59:00Z", "late-night"],
    ["2026-09-15T22:00:00Z", "morning"],
    ["2026-09-16T00:59:00Z", "morning"],
    ["2026-09-16T01:00:00Z", "late-morning"],
    ["2026-09-16T03:59:00Z", "late-morning"],
    ["2026-09-16T04:00:00Z", "midday"],
    ["2026-09-16T06:59:00Z", "midday"],
    ["2026-09-16T07:00:00Z", "afternoon"],
    ["2026-09-16T09:59:00Z", "afternoon"],
    ["2026-09-16T10:00:00Z", "evening"],
    ["2026-09-16T12:59:00Z", "evening"],
    ["2026-09-16T13:00:00Z", "night"],
    ["2026-09-16T15:59:00Z", "night"],
    ["2026-09-16T16:00:00Z", "late-night"],
  ] as const)("uses the %s cover at %s", (iso, expected) => {
    expect(homeCoverMode(null, new Date(iso))).toBe(expected);
  });

  it("gives a birthday cover priority over the time period", () => {
    expect(homeCoverMode("1990-09-16", new Date("2026-09-16T15:00:00Z"))).toBe(
      "birthday",
    );
  });
});
