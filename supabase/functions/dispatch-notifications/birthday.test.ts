import { describe, expect, it } from "vitest";

import {
  birthdayOccurrence,
  memberBirthdayRecipients,
  petBirthdayRecipients,
  petCareRecipients,
  type BirthdayMember,
} from "./birthday";

const members: BirthdayMember[] = [
  { id: "m-owner", household_id: "home-a", user_id: "owner", role: "owner" },
  { id: "m-admin", household_id: "home-a", user_id: "admin", role: "admin" },
  { id: "m-member", household_id: "home-a", user_id: "birthday-person", role: "member" },
  { id: "m-caregiver", household_id: "home-a", user_id: "caregiver", role: "member" },
  { id: "m-observer", household_id: "home-a", user_id: "observer", role: "observer" },
  { id: "m-other", household_id: "home-b", user_id: "other", role: "owner" },
];

describe("birthday notification occurrence", () => {
  it("selects seven-day, one-day and same-day reminders", () => {
    expect(birthdayOccurrence("2000-09-29", "2026-09-22")).toEqual({
      kind: "WEEK_BEFORE",
      occurrenceDate: "2026-09-29",
    });
    expect(birthdayOccurrence("2000-09-23", "2026-09-22")?.kind).toBe(
      "DAY_BEFORE",
    );
    expect(birthdayOccurrence("2000-09-22", "2026-09-22")?.kind).toBe(
      "DUE_DAY",
    );
  });

  it("does not notify on unrelated days", () => {
    expect(birthdayOccurrence("2000-10-01", "2026-09-22")).toBeNull();
  });

  it("observes a leap-day birthday on February 28 in non-leap years", () => {
    expect(birthdayOccurrence("2000-02-29", "2027-02-28")).toEqual({
      kind: "DUE_DAY",
      occurrenceDate: "2027-02-28",
    });
    expect(birthdayOccurrence("2000-02-29", "2028-02-29")).toEqual({
      kind: "DUE_DAY",
      occurrenceDate: "2028-02-29",
    });
  });

  it("rolls the next occurrence across a year boundary", () => {
    expect(birthdayOccurrence("2000-01-01", "2026-12-25")).toEqual({
      kind: "WEEK_BEFORE",
      occurrenceDate: "2027-01-01",
    });
  });

  it("notifies household members but excludes the subject and observers", () => {
    expect(memberBirthdayRecipients(members, "birthday-person")).toEqual([
      "owner",
      "admin",
      "caregiver",
    ]);
  });

  it("notifies pet owners, admins and assigned caregivers only", () => {
    expect(
      petBirthdayRecipients(members, "home-a", ["m-caregiver", "m-observer"]),
    ).toEqual(["owner", "admin", "caregiver"]);
  });

  it("sends pet-care reminders only to assigned caregivers", () => {
    expect(
      petCareRecipients(members, "home-a", ["m-caregiver", "m-observer"]),
    ).toEqual(["caregiver"]);
  });
});
