import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

let currentPath = "/finance";
vi.mock("next/navigation", () => ({ usePathname: () => currentPath }));
import FinanceLayout, { financeBackHref } from "@/app/(app)/finance/layout";

describe("financeBackHref — semantic Back target for every /finance/** subpage shape", () => {
  it("sends every module root one level up, to the Finance Hub", () => {
    for (const pathname of [
      "/finance/reports",
      "/finance/transactions",
      "/finance/tags",
      "/finance/export",
      "/finance/import",
      "/finance/insights",
      "/finance/quick-add",
    ]) {
      expect(financeBackHref(pathname)).toBe("/finance");
    }
  });

  it("sends a section's /new and /[id] pages back to the section root", () => {
    expect(financeBackHref("/finance/budgets/new")).toBe("/finance/budgets");
    expect(financeBackHref("/finance/budgets/abc")).toBe("/finance/budgets");
    expect(financeBackHref("/finance/transactions/abc")).toBe(
      "/finance/transactions",
    );
  });

  it("sends a detail page's own edit/action subpage back to the detail page itself", () => {
    expect(financeBackHref("/finance/goals/abc/edit")).toBe(
      "/finance/goals/abc",
    );
    expect(financeBackHref("/finance/debts/abc/payment")).toBe(
      "/finance/debts/abc",
    );
    expect(financeBackHref("/finance/debts/abc/principal")).toBe(
      "/finance/debts/abc",
    );
    expect(financeBackHref("/finance/transactions/abc/refund")).toBe(
      "/finance/transactions/abc",
    );
    expect(financeBackHref("/finance/transactions/abc/reimbursement")).toBe(
      "/finance/transactions/abc",
    );
  });

  it("collapses an occurrence detail page back to the section root", () => {
    expect(financeBackHref("/finance/bills/occurrences/xyz")).toBe(
      "/finance/bills",
    );
    expect(financeBackHref("/finance/recurring/occurrences/xyz")).toBe(
      "/finance/recurring",
    );
  });

  it("sends an occurrence's own action subpage back to the occurrence detail — except Installments, which has no such detail page", () => {
    expect(financeBackHref("/finance/bills/occurrences/xyz/pay")).toBe(
      "/finance/bills/occurrences/xyz",
    );
    expect(financeBackHref("/finance/recurring/occurrences/xyz/use")).toBe(
      "/finance/recurring/occurrences/xyz",
    );
    // Installments never got a standalone occurrence-detail page — only
    // the pay form itself exists — so it collapses straight to the root.
    expect(financeBackHref("/finance/installments/occurrences/xyz/pay")).toBe(
      "/finance/installments",
    );
  });

  it("returns undefined for /finance itself — it is a BottomNav root and never gets a Back button", () => {
    expect(financeBackHref("/finance")).toBeUndefined();
  });
});

describe("Finance subpage shell", () => {
  it("maps every Finance Tools destination to the shared PageHeader", () => {
    const layout = read("src/app/(app)/finance/layout.tsx");
    for (const section of [
      "transactions",
      "tags",
      "budgets",
      "templates",
      "recurring",
      "bills",
      "installments",
      "goals",
      "debts",
      "reports",
      "net-worth",
      "insights",
      "import",
      "export",
    ]) {
      expect(layout).toContain(section);
    }
    expect(layout).toContain('title={SECTION_TITLES[section] ?? "การเงิน"}');
    expect(layout).toContain('isModuleRoot && section !== "quick-add"');
  });

  it("gives categories the same shared PageHeader, without a root Back button", () => {
    expect(read("src/app/(app)/categories/page.tsx")).toContain(
      '<PageHeader title="หมวดหมู่" />',
    );
  });

  it("uses a responsive one-column date range on narrow screens", () => {
    expect(read("src/app/(app)/finance/transactions/page.tsx")).toContain(
      "grid-cols-1",
    );
    expect(read("src/app/(app)/finance/transactions/page.tsx")).toContain(
      "sm:grid-cols-2",
    );
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
      expect(page).toContain(
        "<FinanceFilterSheet active={hasAdvancedFilters}>",
      );
      expect(page).not.toMatch(/<FinanceFilterSheet active=\{true\}/);
    });

    it("keeps every existing GET filter parameter name exactly as searchTransactions expects", () => {
      for (const name of [
        "dateFrom",
        "dateTo",
        "status",
        "walletId",
        "pocketId",
        "categoryId",
        "tagId",
        "q",
      ]) {
        expect(page).toContain(`name="${name}"`);
      }
      // The type pills' pseudo "TRANSFER" value is page-local UI sugar,
      // resolved before ever reaching TransactionSearchFilters — the
      // actual filter type values passed to searchTransactions are
      // unchanged (see the file's own comment on PILLS).
      expect(page).toMatch(
        /searchTransactions\(supabase,\s*\{\s*\.\.\.sharedFilters,\s*type: "POCKET_TRANSFER",?\s*\}\)/,
      );
      expect(page).toMatch(
        /searchTransactions\(supabase,\s*\{\s*\.\.\.sharedFilters,\s*type: "WALLET_TRANSFER",?\s*\}\)/,
      );
      expect(page).toMatch(
        /searchTransactions\(supabase,\s*\{\s*\.\.\.sharedFilters,\s*type,?\s*\}\)/,
      );
    });
  });

  describe("Finance navigation", () => {
    const layout = read("src/app/(app)/finance/layout.tsx");
    const hub = read("src/app/(app)/finance/page.tsx");

    it("shows the shared cover and navigation at every module root", () => {
      expect(layout).toContain("FinanceModuleTabs");
      expect(layout).toContain("isModuleRoot");
      expect(layout).toContain("<FinanceHeader />");
      expect(hub).not.toContain("<FinanceModuleTabs");
      expect(layout).not.toContain("MODULE_SECTIONS");
    });
  });
});

describe("Finance cover across modules", () => {
  it.each([
    "",
    "/transactions",
    "/budgets",
    "/goals",
    "/bills",
    "/debts",
    "/installments",
    "/recurring",
    "/templates",
    "/reports",
    "/insights",
    "/net-worth",
    "/tags",
    "/import",
    "/export",
  ])(
    "renders one shared cover and the correct selected module at /finance%s",
    (suffix) => {
      currentPath = `/finance${suffix}`;
      const html = renderToStaticMarkup(
        // React.createElement types require this named prop for FinanceLayout.
        // eslint-disable-next-line react/no-children-prop
        createElement(FinanceLayout, {
          children: createElement("div", null, "module-content"),
        }),
      );
      expect(html.match(/>การเงินของบ้าน<\/h1>/g)).toHaveLength(1);
      expect(html).toContain("module-content");
      expect(html).not.toContain('aria-label="ย้อนกลับ"');
      const active = html.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? [];
      expect(active).toHaveLength(1);
      expect(active[0]).toContain(`href="${currentPath}"`);
    },
  );
});
