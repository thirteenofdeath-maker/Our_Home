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

const header = readFileSync(
  resolve(process.cwd(), "src/features/plan/components/PlanHeader.tsx"),
  "utf8",
);

describe("Plan cover summary", () => {
  it("changes all four cover totals with the active plan view", () => {
    expect(source).not.toContain("PlanSummary");
    expect(source).toContain("const cover = {");
    expect(source).toContain("const activeCover = cover[view]");
    expect(source).toContain("{...activeCover}");
    expect(header).toContain("metrics.map");
    expect(source).toContain('view === "calendar"');
    expect(source).not.toContain("listPlanNotes");
    expect(planTabs).not.toContain('value: "notes"');
  });

  it("keeps plan artwork in the page cover instead of inside the calendar", () => {
    expect(source).toContain("<PlanHeader");
    expect(header).toContain("plan-calendar.webp");
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
    for (const label of ["ปฏิทิน", "งาน", "เตือน", "งานบ้าน", "ซื้อของ", "ค่าใช้จ่าย", "คลังของ"]) {
      expect(planTabs).toContain(`label: "${label}"`);
    }
    expect(planTabs).not.toContain("householdViews");
    expect(planTabs).toContain('href: "/calendar?view=chores"');
    expect(planTabs).toContain('href: "/calendar?view=shopping"');
    expect(planTabs).toContain('href: "/calendar?view=inventory"');
    expect(source).toContain('view === "chores"');
    expect(source).toContain('view === "shopping"');
    expect(source).toContain('view === "inventory"');
  });
});

describe("Expense page shared presentation", () => {
  const expenses = readFileSync(
    resolve(process.cwd(), "src/app/(app)/calendar/expenses/page.tsx"),
    "utf8",
  );
  it("uses the plan header for every expense page state", () => {
    expect(expenses.match(/<PlanHeader/g)).toHaveLength(3);
    expect(expenses).not.toContain("<PageHeader");
    expect(expenses.match(/<PlanTabs active="expenses"/g)).toHaveLength(3);
  });
  it("keeps the expense form and permission gate with the shared circular action", () => {
    expect(expenses).toMatch(/canEdit \? \(\s*<FormSheetButton/);
    expect(expenses).toContain("triggerClassName={APP_FAB_CLASSNAME}");
    expect(expenses).toContain('ariaLabel="เพิ่มค่าใช้จ่าย"');
    expect(expenses).toContain("form={<ExpenseForm {...formProps} />}");
    expect(expenses).not.toContain("+ เพิ่มค่าใช้จ่าย");
  });
});
