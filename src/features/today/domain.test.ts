import { describe, expect, it } from "vitest";

import { greetingForBangkok, homeCoverMode } from "./domain";

describe("Today greeting in Bangkok time", () => {
  it.each([
    ["2026-09-15T23:00:00Z", "สวัสดีตอนเช้า"],
    ["2026-09-16T06:00:00Z", "สวัสดีตอนบ่าย"],
    ["2026-09-16T11:00:00Z", "สวัสดีตอนเย็น"],
    ["2026-09-16T15:00:00Z", "สวัสดีตอนดึก"],
  ])("greets at %s", (iso, expected) => {
    expect(greetingForBangkok(new Date(iso))).toBe(expected);
  });
});

describe("Today cover in Bangkok time", () => {
  it.each([
    ["2026-09-15T23:00:00Z", "morning"],
    ["2026-09-16T06:00:00Z", "afternoon"],
    ["2026-09-16T11:00:00Z", "evening"],
    ["2026-09-16T15:00:00Z", "late-night"],
  ] as const)("uses the %s cover", (iso, expected) => {
    expect(homeCoverMode(null, new Date(iso))).toBe(expected);
  });

  it("gives a birthday cover priority over the time period", () => {
    expect(homeCoverMode("1990-09-16", new Date("2026-09-16T15:00:00Z"))).toBe(
      "birthday",
    );
  });
});
