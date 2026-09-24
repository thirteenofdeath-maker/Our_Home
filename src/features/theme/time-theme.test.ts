import { describe, expect, it } from "vitest";

import {
  parseTimeTheme,
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

  it("accepts only the seven explicit QA theme overrides", () => {
    expect(parseTimeTheme("morning")).toBe("morning");
    expect(parseTimeTheme("late-night")).toBe("late-night");
    expect(parseTimeTheme(["evening", "night"])).toBe("evening");
    expect(parseTimeTheme("birthday")).toBeNull();
    expect(parseTimeTheme(undefined)).toBeNull();
  });
});
