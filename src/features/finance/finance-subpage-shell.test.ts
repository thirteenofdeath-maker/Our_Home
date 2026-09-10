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

  describe("/finance/transactions normal view + filter sheet", () => {
    const page = read("src/app/(app)/finance/transactions/page.tsx");

    it("renders the normal search/pills/results UI unconditionally — none of it lives inside the FinanceFilterSheet", () => {
      // The search input, the type pills, and the results all sit as
      // page-level JSX siblings of <FinanceFilterSheet>, not as its
      // children — only the ADVANCED filter form (date/status/wallet/
      // pocket/category/tag) is passed into the sheet. This is what
      // guarantees the normal page is visible independent of the sheet's
      // own open/closed state.
      const sheetOpenIdx = page.indexOf("<FinanceFilterSheet");
      const sheetCloseIdx = page.indexOf("</FinanceFilterSheet>");
      expect(sheetOpenIdx).toBeGreaterThan(-1);
      expect(sheetCloseIdx).toBeGreaterThan(sheetOpenIdx);

      const searchInputIdx = page.indexOf('name="q"');
      const pillsIdx = page.indexOf("PILLS.map");
      const resultsIdx = page.indexOf("groups.map");
      // The search input sits before the sheet opens (a sibling above it).
      expect(searchInputIdx).toBeGreaterThan(-1);
      expect(searchInputIdx).toBeLessThan(sheetOpenIdx);
      // Pills and results render after the sheet closes — outside it entirely.
      expect(pillsIdx).toBeGreaterThan(sheetCloseIdx);
      expect(resultsIdx).toBeGreaterThan(sheetCloseIdx);
    });

    it("derives the sheet's active-indicator from real search params, never a hardcoded open state", () => {
      expect(page).toContain("hasAdvancedFilters");
      expect(page).toContain("<FinanceFilterSheet active={hasAdvancedFilters}>");
      expect(page).not.toMatch(/<FinanceFilterSheet active=\{true\}/);
    });

    it("keeps every existing GET filter parameter name exactly as searchTransactions expects", () => {
      for (const name of ["dateFrom", "dateTo", "status", "walletId", "pocketId", "categoryId", "tagId", "q"]) {
        expect(page).toContain(`name="${name}"`);
      }
      // The type pills' pseudo "TRANSFER" value is page-local UI sugar,
      // resolved before ever reaching TransactionSearchFilters — the
      // actual filter type values passed to searchTransactions are
      // unchanged (see the file's own comment on PILLS).
      expect(page).toContain('searchTransactions(supabase, { ...sharedFilters, type: "POCKET_TRANSFER" }');
      expect(page).toContain('searchTransactions(supabase, { ...sharedFilters, type: "WALLET_TRANSFER" }');
      expect(page).toContain("searchTransactions(supabase, { ...sharedFilters, type })");
    });
  });
});
