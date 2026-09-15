import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/(app)/page.tsx"),
  "utf8",
);

describe("Today dashboard composition", () => {
  it("is a read-model dashboard rather than a redirect to wallets", () => {
    expect(source).not.toContain('redirect("/wallets")');
    expect(source).toContain("greetingForBangkok()");
    expect(source).toContain("งานวันนี้");
    expect(source).toContain("ปฏิทินครอบครัว");
    expect(source).toContain('title="การเงิน"');
    expect(source).toContain('title="สัตว์เลี้ยง"');
    expect(source).toContain("<QuickLink");
  });

  it("composes source modules without writing duplicate records", () => {
    for (const sourceFunction of [
      "listCalendarEvents",
      "listPlanTasks",
      "listPlanReminders",
      "listCalendarFinanceItems",
      "getFinanceSummary",
      "listRecentFinanceTransactions",
      "listPets",
    ]) {
      expect(source).toContain(sourceFunction);
    }
    expect(source).not.toMatch(/\.from\(|\.insert\(|\.update\(/u);
  });
});
