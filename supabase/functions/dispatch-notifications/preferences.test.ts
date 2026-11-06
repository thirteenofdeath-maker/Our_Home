import { describe, expect, it } from "vitest";

import {
  notificationDeliveryModeAllows,
  notificationPreferenceAllows,
} from "./preferences";

const preference: Record<string, boolean> = {
  member_birthdays_enabled: true,
  inventory_enabled: true,
  birthday_week_before_enabled: false,
  day_before_enabled: true,
  due_day_enabled: true,
};

describe("notification preferences", () => {
  it("preserves individual birthday reminders in digest mode but keeps ordinary items summarized", () => {
    for (const sourceType of ["MEMBER_BIRTHDAY", "PET_BIRTHDAY"]) {
      expect(
        notificationDeliveryModeAllows(
          { sourceType, kind: "DUE_DAY", category: "plan" },
          true,
        ),
      ).toBe(true);
      expect(
        notificationDeliveryModeAllows(
          { sourceType, kind: "DUE_DAY", category: "plan" },
          false,
        ),
      ).toBe(true);
    }
    expect(
      notificationDeliveryModeAllows(
        { sourceType: "TASK", kind: "DUE_DAY", category: "plan" },
        true,
      ),
    ).toBe(false);
    expect(
      notificationDeliveryModeAllows(
        { sourceType: "DAILY_DIGEST", kind: "DUE_DAY", category: "plan" },
        true,
      ),
    ).toBe(true);
    expect(
      notificationDeliveryModeAllows(
        { sourceType: "DAILY_DIGEST", kind: "DUE_DAY", category: "plan" },
        false,
      ),
    ).toBe(false);
  });

  it("still respects birthday topic and timing switches after the digest exception", () => {
    const candidate = {
      sourceType: "MEMBER_BIRTHDAY",
      kind: "DUE_DAY",
      category: "plan",
      preferenceKey: "member_birthdays_enabled",
    };
    expect(
      notificationPreferenceAllows(candidate, {
        ...preference,
        member_birthdays_enabled: false,
      }),
    ).toBe(false);
    expect(
      notificationPreferenceAllows(candidate, {
        ...preference,
        due_day_enabled: false,
      }),
    ).toBe(false);
    expect(
      notificationPreferenceAllows(
        { ...candidate, kind: "DAY_BEFORE" },
        { ...preference, day_before_enabled: false },
      ),
    ).toBe(false);
  });
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
