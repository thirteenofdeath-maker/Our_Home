import { describe, expect, it } from "vitest";

import {
  planDateLabel,
  planNoteFormSchema,
  planReminderFormSchema,
  planTaskFormSchema,
  reminderInputParts,
  reminderIso,
} from "./domain";

describe("Plan domain", () => {
  it("requires a due date when a task has a due time", () => {
    const result = planTaskFormSchema.safeParse({
      title: "ซื้ออาหารแมว",
      details: "",
      listName: "งานบ้าน",
      scope: "HOUSEHOLD",
      dueDate: "",
      dueTime: "18:30",
      priority: "HIGH",
    });
    expect(result.success).toBe(false);
  });

  it("allows a note with content and no title", () => {
    const result = planNoteFormSchema.safeParse({
      title: "",
      content: "รหัสตู้จดหมาย 1234",
      scope: "PERSONAL",
      color: "SAGE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty note", () => {
    const result = planNoteFormSchema.safeParse({
      title: " ",
      content: " ",
      scope: "PERSONAL",
      color: "WHITE",
    });
    expect(result.success).toBe(false);
  });

  it("formats date-only tasks without timezone drift", () => {
    expect(planDateLabel("2026-09-15", null)).toContain("15");
    expect(planDateLabel("2026-09-15", "08:30:00")).toContain("08:30");
  });

  it("round-trips Bangkok reminder date and time", () => {
    const iso = reminderIso("2026-09-16", "08:30");
    expect(reminderInputParts(iso)).toEqual({
      date: "2026-09-16",
      time: "08:30",
    });
  });

  it("requires both reminder date and time", () => {
    expect(
      planReminderFormSchema.safeParse({
        title: "ให้ยาแมว",
        note: "",
        scope: "HOUSEHOLD",
        remindDate: "2026-09-16",
        remindTime: "",
        recurrence: "DAILY",
      }).success,
    ).toBe(false);
  });
});
