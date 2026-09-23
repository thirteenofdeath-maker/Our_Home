import { describe, expect, it } from "vitest";

import {
  isDarkTimeTheme,
  timeThemeForBangkok,
  timeThemeForHour,
} from "./time-theme";

describe("timeThemeForHour", () => {
  it.each([
    [4, "late-night"],
    [5, "morning"],
    [8, "late-morning"],
    [11, "midday"],
    [14, "afternoon"],
    [17, "evening"],
    [20, "night"],
    [23, "late-night"],
  ] as const)("maps %s:00 to %s", (hour, expected) => {
    expect(timeThemeForHour(hour)).toBe(expected);
  });

  it("uses Bangkok time rather than the device or server timezone", () => {
    expect(timeThemeForBangkok(new Date("2026-09-23T01:00:00Z"))).toBe(
      "late-morning",
    );
  });

  it("marks only the two night palettes as dark", () => {
    expect(isDarkTimeTheme("evening")).toBe(false);
    expect(isDarkTimeTheme("night")).toBe(true);
    expect(isDarkTimeTheme("late-night")).toBe(true);
  });
});
