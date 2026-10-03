import { describe, expect, it } from "vitest";

import {
  choreDayHeading,
  choreScheduleDefaults,
  groupChoresByDate,
  resolveChoreSchedule,
} from "./schedule";

describe("chore schedule choices", () => {
  it("moves a weekly choice to the selected weekday", () => {
    expect(
      resolveChoreSchedule({
        mode: "WEEKDAY",
        startsOn: "2026-10-03",
        weekday: 0,
        monthDay: 1,
        customCadence: "DAILY",
        customIntervalCount: 1,
      }),
    ).toEqual({ cadence: "WEEKLY", intervalCount: 1, startsOn: "2026-10-04" });
  });

  it("keeps a monthly day anchor even when the current month is shorter", () => {
    expect(
      resolveChoreSchedule({
        mode: "MONTH_DAY",
        startsOn: "2027-02-01",
        weekday: 0,
        monthDay: 31,
        customCadence: "DAILY",
        customIntervalCount: 1,
      }),
    ).toEqual({ cadence: "MONTHLY", intervalCount: 1, startsOn: "2027-03-31" });
  });

  it("recognizes stored weekly and monthly presets", () => {
    expect(
      choreScheduleDefaults(
        { cadence: "WEEKLY", interval_count: 1, starts_on: "2026-10-04" },
        "2026-10-03",
      ),
    ).toMatchObject({ mode: "WEEKDAY", weekday: 0 });
    expect(
      choreScheduleDefaults(
        { cadence: "MONTHLY", interval_count: 1, starts_on: "2026-10-15" },
        "2026-10-03",
      ),
    ).toMatchObject({ mode: "MONTH_DAY", monthDay: 15 });
  });
});

describe("chore day grouping", () => {
  it("groups already-sorted occurrences under one date header", () => {
    expect(
      groupChoresByDate([
        { id: "a", due_date: "2026-10-03" },
        { id: "b", due_date: "2026-10-03" },
        { id: "c", due_date: "2026-10-04" },
      ]),
    ).toEqual([
      {
        date: "2026-10-03",
        chores: [
          { id: "a", due_date: "2026-10-03" },
          { id: "b", due_date: "2026-10-03" },
        ],
      },
      { date: "2026-10-04", chores: [{ id: "c", due_date: "2026-10-04" }] },
    ]);
  });

  it("labels today and tomorrow in plain language", () => {
    expect(choreDayHeading("2026-10-03", "2026-10-03")).toBe("วันนี้");
    expect(choreDayHeading("2026-10-04", "2026-10-03")).toBe("พรุ่งนี้");
  });
});
