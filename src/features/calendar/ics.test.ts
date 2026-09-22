import { describe, expect, it } from "vitest";
import { bangkokDueDateTime, buildIcsCalendar } from "./ics";

describe("calendar ICS export", () => {
  it("escapes content and uses exclusive all-day end dates", () => {
    const result = buildIcsCalendar(
      [
        {
          uid: "event-1",
          title: "ยา, แมว; เช้า",
          description: "บรรทัด 1\nบรรทัด 2",
          allDayDate: "2026-09-22",
        },
      ],
      new Date("2026-09-22T00:00:00Z"),
    );
    expect(result).toContain("DTSTART;VALUE=DATE:20260922");
    expect(result).toContain("DTEND;VALUE=DATE:20260923");
    expect(result).toContain("SUMMARY:ยา\\, แมว\\; เช้า");
    expect(result).toContain("DESCRIPTION:บรรทัด 1\\nบรรทัด 2");
    expect(result.endsWith("\r\n")).toBe(true);
  });

  it("exports Bangkok task times as UTC and supports yearly birthdays", () => {
    expect(bangkokDueDateTime("2026-09-22", "09:30:00")).toBe(
      "2026-09-22T02:30:00.000Z",
    );
    expect(
      buildIcsCalendar([
        {
          uid: "birthday",
          title: "วันเกิด",
          allDayDate: "2000-02-29",
          recurrence: "YEARLY",
        },
      ]),
    ).toContain("RRULE:FREQ=YEARLY");
  });

  it("folds long Unicode lines to RFC-compatible byte lengths", () => {
    const result = buildIcsCalendar([
      { uid: "long", title: "ก".repeat(80), allDayDate: "2026-09-22" },
    ]);
    for (const line of result.trimEnd().split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
