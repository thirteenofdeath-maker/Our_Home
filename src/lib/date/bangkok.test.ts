import { describe, expect, it } from "vitest";

import { ageOnBangkokDate, bangkokDateKey } from "./bangkok";

describe("Bangkok calendar date", () => {
  it("advances to the next day at Bangkok midnight", () => {
    expect(bangkokDateKey(new Date("2026-09-15T17:00:00Z"))).toBe(
      "2026-09-16",
    );
  });

  it("calculates age from the Bangkok date rather than the server timezone", () => {
    expect(
      ageOnBangkokDate("2000-09-16", new Date("2026-09-15T18:00:00Z")),
    ).toBe(26);
  });
});
