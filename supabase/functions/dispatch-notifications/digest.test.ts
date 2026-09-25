import { describe, expect, it } from "vitest";

import {
  addDigestCount,
  addDigestDetail,
  birthdayFallsInWindow,
  digestBody,
} from "./digest";

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

  it("names the inventory item instead of showing only a vague count", () => {
    expect(
      digestBody(
        {
          tasks: 0,
          appointments: 0,
          birthdays: 0,
          bills: 0,
          pets: 0,
          inventory: 1,
        },
        "DAILY",
        { inventory: ["อาหารแมว ใกล้หมด"] },
      ),
    ).toBe("คลังของ: อาหารแมว ใกล้หมด");
  });

  it("shows the first inventory item and the remaining count compactly", () => {
    const details = new Map();
    addDigestDetail(details, ["user-1"], "inventory", "อาหารแมว ใกล้หมด");
    addDigestDetail(details, ["user-1"], "inventory", "ทรายแมว ใกล้หมด");
    expect(
      digestBody(
        {
          tasks: 0,
          appointments: 0,
          birthdays: 0,
          bills: 0,
          pets: 0,
          inventory: 2,
        },
        "DAILY",
        details.get("user-1"),
      ),
    ).toBe("คลังของ: อาหารแมว ใกล้หมด และอีก 1 รายการ");
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
