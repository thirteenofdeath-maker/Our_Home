import { describe, expect, it } from "vitest";

import {
  ageOnBangkokDate,
  bangkokDateKey,
  bangkokDateTimeInput,
  bangkokDateTimeInputForDate,
  bangkokDateTimeInputFromIso,
  parseBangkokDateTimeInput,
} from "./bangkok";

describe("Bangkok calendar date", () => {
  it("advances to the next day at Bangkok midnight", () => {
    expect(bangkokDateKey(new Date("2026-09-15T17:00:00Z"))).toBe("2026-09-16");
  });

  it("calculates age from the Bangkok date rather than the server timezone", () => {
    expect(
      ageOnBangkokDate("2000-09-16", new Date("2026-09-15T18:00:00Z")),
    ).toBe(26);
  });
});

describe("Bangkok date-time fields", () => {
  const instant = new Date("2026-09-28T02:46:00.000Z");

  it("formats current and existing instants for datetime-local controls", () => {
    expect(bangkokDateTimeInput(instant)).toBe("2026-09-28T09:46");
    expect(bangkokDateTimeInputFromIso(instant.toISOString())).toBe(
      "2026-09-28T09:46",
    );
    expect(bangkokDateTimeInputForDate("2026-10-05", instant)).toBe(
      "2026-10-05T09:46",
    );
  });

  it("parses datetime-local as Bangkok time and retains date-only compatibility", () => {
    expect(parseBangkokDateTimeInput("2026-09-28T09:46")?.toISOString()).toBe(
      "2026-09-28T02:46:00.000Z",
    );
    expect(parseBangkokDateTimeInput("2026-09-28")?.toISOString()).toBe(
      "2026-09-28T05:00:00.000Z",
    );
    expect(parseBangkokDateTimeInput("not-a-date")).toBeNull();
  });
});
