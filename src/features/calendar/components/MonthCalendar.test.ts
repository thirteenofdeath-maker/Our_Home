import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalendarEventView } from "../types";
import { MonthCalendar } from "./MonthCalendar";

const todayEvent: CalendarEventView = {
  id: "event-1", household_id: null, created_by: "user-1", title: "Today's event", note: null,
  scope: "PERSONAL", starts_at: null, ends_at: null, is_all_day: true, all_day_date: "2026-09-10",
  archived_at: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  participants: [], creatorName: "User", creatorColor: "#7A9E7E",
};

describe("MonthCalendar selection semantics", () => {
  it("renders today's event immediately and marks today as selected", () => {
    const html = renderToStaticMarkup(createElement(MonthCalendar, { month: "2026-09", selected: "2026-09-10", today: "2026-09-10", events: [todayEvent] }));
    expect(html).toContain("Today&#x27;s event");
    expect(html).toContain('aria-current="date"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain("2026-09-10 มีกิจกรรม 1 วันนี้ เลือกอยู่");
  });

  it("provides exact links for selecting another date", () => {
    const html = renderToStaticMarkup(createElement(MonthCalendar, { month: "2026-09", selected: "2026-09-21", today: "2026-09-10", events: [] }));
    expect(html).toContain('href="/calendar?month=2026-09&amp;date=2026-09-21"');
    expect(html).toContain("2026-09-21 มีกิจกรรม 0 เลือกอยู่");
  });

  it("does not mark the same day number as today in another month", () => {
    const html = renderToStaticMarkup(createElement(MonthCalendar, { month: "2026-10", selected: "2026-10-01", today: "2026-09-10", events: [] }));
    expect(html).not.toContain('aria-current="date"');
    expect(html).not.toContain("2026-10-10 มีกิจกรรม 0 วันนี้");
  });
});
