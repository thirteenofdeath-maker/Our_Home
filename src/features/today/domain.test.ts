import { describe, expect, it } from "vitest";

import { greetingForBangkok } from "./domain";

describe("Today greeting in Bangkok time", () => {
  it.each([
    ["2026-09-15T23:00:00Z", "สวัสดีตอนเช้า"],
    ["2026-09-16T06:00:00Z", "สวัสดีตอนบ่าย"],
    ["2026-09-16T11:00:00Z", "สวัสดีตอนเย็น"],
    ["2026-09-16T15:00:00Z", "สวัสดีตอนดึก"],
  ])("greets at %s", (iso, expected) => {
    expect(greetingForBangkok(new Date(iso))).toBe(expected);
  });
});
