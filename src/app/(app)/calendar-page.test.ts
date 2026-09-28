import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/(app)/calendar/page.tsx"),
  "utf8",
);
const monthCalendar = readFileSync(
  resolve(
    process.cwd(),
    "src/features/calendar/components/MonthCalendar.tsx",
  ),
  "utf8",
);

describe("Plan cover summary", () => {
  it("keeps the four plan totals in the cover instead of a section per tab", () => {
    expect(source).not.toContain("PlanSummary");
    expect(source).toContain("todayEventCount");
    expect(source).toContain("dueTaskCount");
    expect(source).toContain("upcomingReminderCount");
    expect(source).toContain("activeNotes.length");
  });

  it("keeps plan artwork in the page cover instead of inside the calendar", () => {
    expect(source).toContain("plan-calendar.webp");
    expect(monthCalendar).not.toContain("plan-calendar.webp");
    expect(monthCalendar).not.toContain("<Image");
  });
});
