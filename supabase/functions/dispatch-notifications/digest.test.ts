import { describe, expect, it } from "vitest";

import { addDigestCount, birthdayFallsInWindow, digestBody } from "./digest";

describe("notification digests", () => {
  it("deduplicates recipients while accumulating categories", () => {
    const counts = new Map();
    addDigestCount(counts, ["a", "a", "b"], "tasks");
    addDigestCount(counts, ["a"], "bills");
    expect(counts.get("a")).toMatchObject({ tasks: 1, bills: 1 });
    expect(counts.get("b")).toMatchObject({ tasks: 1, bills: 0 });
  });

  it("builds one compact summary instead of many messages", () => {
    expect(
      digestBody(
        {
          tasks: 3,
          appointments: 1,
          birthdays: 0,
          bills: 2,
          pets: 1,
          inventory: 2,
        },
        "DAILY",
      ),
    ).toBe("3 งาน · 1 นัดหมาย · 2 บิล · 1 รายการสัตว์เลี้ยง · 2 รายการคลังของ");
  });

  it("finds birthdays across the new-year boundary", () => {
    expect(
      birthdayFallsInWindow("2000-01-02", "2026-12-29", "2027-01-04"),
    ).toBe(true);
    expect(
      birthdayFallsInWindow("2000-02-02", "2026-12-29", "2027-01-04"),
    ).toBe(false);
  });
});
