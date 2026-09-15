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
    expect(source).toContain("ภาพรวมของบ้านวันนี้");
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
