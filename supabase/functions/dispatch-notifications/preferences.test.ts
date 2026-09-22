import { describe, expect, it } from "vitest";

import { notificationPreferenceAllows } from "./preferences";

const preference: Record<string, boolean> = {
  member_birthdays_enabled: true,
  inventory_enabled: true,
  birthday_week_before_enabled: false,
  day_before_enabled: true,
  due_day_enabled: true,
};

describe("notification preferences", () => {
  it("applies the seven-day birthday toggle only to birthdays", () => {
    expect(
      notificationPreferenceAllows(
        {
          sourceType: "MEMBER_BIRTHDAY",
          kind: "WEEK_BEFORE",
          category: "plan",
          preferenceKey: "member_birthdays_enabled",
        },
        preference,
      ),
    ).toBe(false);
    expect(
      notificationPreferenceAllows(
        {
          sourceType: "INVENTORY",
          kind: "WEEK_BEFORE",
          category: "inventory",
          preferenceKey: "inventory_enabled",
        },
        preference,
      ),
    ).toBe(true);
  });

  it("still requires the inventory category toggle", () => {
    expect(
      notificationPreferenceAllows(
        {
          sourceType: "INVENTORY",
          kind: "WEEK_BEFORE",
          category: "inventory",
          preferenceKey: "inventory_enabled",
        },
        { ...preference, inventory_enabled: false },
      ),
    ).toBe(false);
  });
});
