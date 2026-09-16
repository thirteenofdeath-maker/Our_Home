import { describe, expect, it } from "vitest";

import { getDayCover } from "./day-cover";

describe("time-based Today cover", () => {
  it.each([
    ["2026-09-16T00:30:00Z", "morning"],
    ["2026-09-16T06:30:00Z", "day"],
    ["2026-09-16T10:30:00Z", "evening"],
    ["2026-09-16T15:30:00Z", "night"],
  ] as const)("selects %s in Bangkok as %s", (iso, tone) => {
    expect(getDayCover(new Date(iso), null, "อาทิตย์").tone).toBe(tone);
  });

  it("gives birthday priority over the normal time state", () => {
    const cover = getDayCover(
      new Date("2026-09-16T15:30:00Z"),
      "1994-09-16",
      "อาทิตย์",
    );
    expect(cover.tone).toBe("birthday");
    expect(cover.title).toContain("อาทิตย์");
  });
});
