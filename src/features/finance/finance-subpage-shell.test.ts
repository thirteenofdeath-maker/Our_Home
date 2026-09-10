import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Finance subpage shell", () => {
  it("maps every Finance Tools destination to the shared PageHeader", () => {
    const layout = read("src/app/(app)/finance/layout.tsx");
    for (const section of ["transactions", "tags", "budgets", "templates", "recurring", "bills", "installments", "goals", "debts", "reports", "net-worth", "insights", "import", "export"]) {
      expect(layout).toContain(section);
    }
    expect(layout).toContain('<PageHeader title={SECTION_TITLES[section] ?? "การเงิน"} fallbackHref="/finance" />');
  });

  it("gives categories the same Finance fallback header", () => {
    expect(read("src/app/(app)/categories/page.tsx")).toContain('<PageHeader title="หมวดหมู่" fallbackHref="/finance" />');
  });

  it("uses a responsive one-column date range on narrow screens", () => {
    expect(read("src/app/(app)/finance/transactions/page.tsx")).toContain("grid-cols-1");
    expect(read("src/app/(app)/finance/transactions/page.tsx")).toContain("sm:grid-cols-2");
  });
});
