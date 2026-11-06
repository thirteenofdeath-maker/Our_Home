import { describe, expect, it } from "vitest";
import { bangkokDateKey } from "./calendar";
import {
  birthdayDateInYear,
  birthdayOccurrences,
  birthdayGreeting,
  withOwnBirthday,
  type BirthdaySource,
} from "./birthdays";

const member: BirthdaySource = {
  subject_type: "MEMBER",
  subject_id: "member",
  display_name: "อาทิตย์",
  month_day: "11-06",
};
const pet: BirthdaySource = {
  subject_type: "PET",
  subject_id: "pet",
  display_name: "โมจิ",
  month_day: "11-06",
};

describe("virtual calendar birthdays", () => {
  it("repeats annually without duplicates and puts members ahead of pets", () => {
    const result = birthdayOccurrences(
      [pet, member, member],
      "2026-11-01",
      "2027-12-01",
    );
    expect(
      result.map(({ subject_type, date }) => [subject_type, date]),
    ).toEqual([
      ["MEMBER", "2026-11-06"],
      ["PET", "2026-11-06"],
      ["MEMBER", "2027-11-06"],
      ["PET", "2027-11-06"],
    ]);
    expect(result[0].href).toBe("/household/members");
    expect(result[1].href).toBe("/pets/pet");
  });

  it("includes the start but excludes the end and spans New Year", () => {
    const sources: BirthdaySource[] = [
      { ...member, month_day: "12-31" },
      { ...pet, month_day: "01-01" },
    ];
    expect(
      birthdayOccurrences(sources, "2026-12-31", "2027-01-02").map(
        (b) => b.date,
      ),
    ).toEqual(["2026-12-31", "2027-01-01"]);
    expect(birthdayOccurrences([member], "2026-11-05", "2026-11-06")).toEqual(
      [],
    );
  });

  it("observes February 29 consistently in leap and non-leap years", () => {
    expect(birthdayDateInYear("02-29", 2027)).toBe("2027-02-28");
    expect(birthdayDateInYear("02-29", 2028)).toBe("2028-02-29");
    expect(birthdayDateInYear("02-30", 2026)).toBeNull();
    expect(birthdayDateInYear("13-01", 2026)).toBeNull();
  });

  it("shows the caller's private birthday without a birth year or duplicate shared copy", () => {
    const own = { birthday: "1994-11-06", display_name: "อาทิตย์" };
    expect(withOwnBirthday([member], own, "member")).toEqual([member]);
    const privateSources = withOwnBirthday([pet], own, "member");
    const privateBirthday = birthdayOccurrences(
      privateSources,
      "2026-11-06",
      "2026-11-07",
    )[0];
    expect(privateBirthday.personal).toBe(true);
    expect(privateBirthday.href).toBe("/profile/edit");
    expect(JSON.stringify(privateBirthday)).not.toContain("1994");
    expect(withOwnBirthday([], null, "member")).toEqual([]);
  });

  it("uses the Bangkok day and combines all celebrants in one greeting", () => {
    const today = bangkokDateKey(new Date("2026-11-05T17:01:00Z"));
    expect(today).toBe("2026-11-06");
    const result = birthdayOccurrences([pet, member], today, "2026-11-07");
    expect(birthdayGreeting(result)).toBe(
      "สุขสันต์วันเกิด อาทิตย์ และ โมจิ 🎉",
    );
  });
});
