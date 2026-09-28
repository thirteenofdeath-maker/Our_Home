import { describe, expect, it } from "vitest";

import {
  financeDateTimeParts,
  financeOccurredAtToIso,
} from "./occurred-at";

describe("finance occurred-at", () => {
  it("defaults date and time controls to the current Bangkok minute", () => {
    expect(
      financeDateTimeParts(null, new Date("2026-09-28T21:15:42.000Z")),
    ).toEqual({ date: "2026-09-29", time: "04:15" });
  });

  it("shows an existing ISO instant in Bangkok time", () => {
    expect(financeDateTimeParts("2026-09-28T18:30:00.000Z")).toEqual({
      date: "2026-09-29",
      time: "01:30",
    });
  });

  it("combines the selected Bangkok date and time into UTC", () => {
    expect(financeOccurredAtToIso("2026-09-29T04:15")).toBe(
      "2026-09-28T21:15:00.000Z",
    );
  });

  it("keeps date-only input backward compatible at Bangkok noon", () => {
    expect(financeOccurredAtToIso("2026-09-29")).toBe(
      "2026-09-29T05:00:00.000Z",
    );
  });

  it("rejects impossible dates and times", () => {
    expect(financeOccurredAtToIso("2026-02-30T10:00")).toBeNull();
    expect(financeOccurredAtToIso("2026-09-29T25:00")).toBeNull();
  });
});
