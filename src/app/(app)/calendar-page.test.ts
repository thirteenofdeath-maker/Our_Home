import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/(app)/calendar/page.tsx"),
  "utf8",
);
const monthCalendar = readFileSync(
  resolve(process.cwd(), "src/features/calendar/components/MonthCalendar.tsx"),
  "utf8",
);
const planTabs = readFileSync(
  resolve(process.cwd(), "src/features/plan/components/PlanTabs.tsx"),
  "utf8",
);

describe("Plan cover summary", () => {
  it("changes all four cover totals with the active plan view", () => {
    expect(source).not.toContain("PlanSummary");
    expect(source).toContain("const cover = {");
    expect(source).toContain("const activeCover = cover[view]");
    expect(source).toContain("activeCover.metrics.map");
    expect(source).toContain('view === "calendar"');
    expect(source).not.toContain("listPlanNotes");
    expect(planTabs).not.toContain('value: "notes"');
  });

  it("keeps plan artwork in the page cover instead of inside the calendar", () => {
    expect(source).toContain("plan-calendar.webp");
    expect(monthCalendar).not.toContain("plan-calendar.webp");
    expect(monthCalendar).not.toContain("<Image");
  });

  it("surfaces household operations in a new plan hub header", () => {
    expect(source).toContain("listChoreWorkspace");
    expect(source).toContain("listShoppingItems");
    expect(source).toContain("listInventoryItems");
    expect(source).toContain("<PlanTabs active={view} />");
    expect(source).not.toContain("<PlanModuleCard");
    expect(planTabs).toContain('aria-label="ศูนย์แผนงาน"');
    expect(planTabs).toContain("วางแผน");
    expect(planTabs).toContain("ดูแลบ้าน");
    expect(planTabs).toContain('href: "/calendar?view=chores"');
    expect(planTabs).toContain('href: "/calendar?view=shopping"');
    expect(planTabs).toContain('href: "/calendar?view=inventory"');
    expect(source).toContain('view === "chores"');
    expect(source).toContain('view === "shopping"');
    expect(source).toContain('view === "inventory"');
  });
});
