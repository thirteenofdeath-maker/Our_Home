import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const reports = read("src/app/(app)/finance/reports/page.tsx");
const budgets = read("src/app/(app)/finance/budgets/page.tsx");
const installments = read("src/app/(app)/finance/installments/page.tsx");
const debts = read("src/app/(app)/finance/debts/page.tsx");
const goals = read("src/app/(app)/finance/goals/page.tsx");
const netWorth = read("src/app/(app)/finance/net-worth/page.tsx");
const allPages = { reports, budgets, installments, debts, goals, netWorth };

describe("Finance V2 Phase 2 module pages", () => {
  it("introduces no new Supabase query on any of the six redesigned pages — every read still goes through the existing api.ts selectors", () => {
    // `s\.rpc(`/`supabase\.rpc(`/`.from(\"` catches a real Supabase call;
    // deliberately excludes `Array.from(...)`, which the reports page
    // uses for a plain in-memory Set dedupe, not a query.
    for (const [name, source] of Object.entries(allPages)) {
      expect(source, `${name} should not call supabase.rpc directly`).not.toMatch(/\bsupabase\.rpc\(|\bs\.rpc\(/);
      expect(source, `${name} should not call .from("...") directly`).not.toMatch(/\.from\(["'][a-z_]+["']\)/);
    }
  });

  it("never combines unlike currencies — every page groups/renders per currency", () => {
    expect(reports).toContain("byCurrency");
    expect(reports).toMatch(/currency\)\s*=>/); // grouped map keyed by currency
    expect(netWorth).toContain("row.currency");
    expect(netWorth).not.toMatch(/reduce\s*\([\s\S]{0,200}netWorth/);
    expect(debts).toContain("totalsByCurrency");
    expect(installments).toMatch(/plan\.currency/);
  });

  it("uses exact decimal-string arithmetic (subtractMoney/addMoney/sumMoney), never Number()/parseFloat for an authoritative displayed amount", () => {
    expect(reports).toContain("subtractMoney(m.income, m.expense)");
    expect(debts).toContain("sumMoney(outstanding");
    expect(netWorth).toContain("addMoney(row.walletAssets, row.receivables)");
    // Number()/parseFloat may still appear, but only for chart/progress
    // RATIOS (0-100% sizing), never assigned straight into a
    // formatCurrency(...) call — spot-check a few known-safe usages.
    for (const source of Object.values(allPages)) {
      expect(source).not.toMatch(/formatCurrency\(\s*Number\(/);
      expect(source).not.toMatch(/formatCurrency\(\s*parseFloat/);
    }
  });

  describe("Reports category percentages — exact decimal-string aggregation", () => {
    it("never sums or sorts category amounts with Number()/parseFloat — uses the exact money helpers instead", () => {
      expect(reports).not.toMatch(/reduce\s*\(\s*\(\s*sum\s*,\s*row\s*\)\s*=>\s*sum\s*\+\s*Number\(/);
      expect(reports).not.toMatch(/sort\s*\(\s*\(\s*a\s*,\s*b\s*\)\s*=>\s*Number\(b\.amount\)\s*-\s*Number\(a\.amount\)\s*\)/);
      expect(reports).toContain("sumMoney(sortedRows.map((row) => row.amount))");
      expect(reports).toContain("compareMoney(b.amount, a.amount)");
      expect(reports).toContain("percentOfTotal(row.amount, total)");
    });

    it("computes the total/percentage per byCurrency group, never mixing currencies into one denominator", () => {
      const groupBlock = reports.slice(reports.indexOf("byCurrency.entries()"), reports.indexOf("byCurrency.entries()") + 1200);
      expect(groupBlock).toContain("sumMoney(sortedRows.map((row) => row.amount))");
      expect(groupBlock).toContain("percentOfTotal(");
    });
  });

  describe("/finance/installments — data-sufficiency correction", () => {
    it("makes exactly one call to listInstallmentPlans and never calls listInstallmentOccurrences (no N+1)", () => {
      expect(installments).toContain("listInstallmentPlans(supabase");
      // Matches an actual invocation, not the explanatory comment in the
      // page itself, which names listInstallmentOccurrences in prose to
      // explain why it's used by the detail page but not here.
      expect(installments).not.toMatch(/listInstallmentOccurrences\(/);
      expect(installments).not.toContain("import { listInstallmentOccurrences }");
      // No Promise.all/map loop issuing one query per plan.
      expect(installments).not.toMatch(/Promise\.all\(\s*(active|plans)\.map/);
    });

    it("shows only fields listInstallmentPlans itself returns — no paid count, remaining amount, next due date, or completion state", () => {
      for (const invented of ["paidCount", "amountPaid", "amountRemaining", "nextDueDate", "totalCount", "isComplete"]) {
        expect(installments).not.toContain(invented);
      }
      expect(installments).toContain("plan.totalAmount");
      expect(installments).toContain("plan.installmentCount");
      expect(installments).toContain("plan.startDate");
      expect(installments).toContain("plan.intervalMonths");
    });

    it("never treats archivedAt as a completion/success state, and drops the occurrence-dependent กำลังผ่อน/ผ่อนสำเร็จ toggle", () => {
      expect(installments).not.toContain("ผ่อนสำเร็จ");
      expect(installments).not.toContain("กำลังผ่อน");
      expect(installments).not.toContain("<FinanceSegmentedControl");
      // archivedAt still only ever gates the existing archived/collapsible
      // section (same pattern as Budgets/Wallets), never a "completed" label.
      expect(installments).toContain("p.archivedAt");
      expect(installments).toContain("<details");
    });

    it("has no Number/parseFloat/parseInt/toFixed at all — nothing here needs a ratio or exact-money helper once occurrence data is gone", () => {
      expect(installments).not.toMatch(/\bNumber\(|\bparseFloat\(|\bparseInt\(|\.toFixed\(/);
    });
  });

  describe("one creation affordance at a time — no duplicate FAB / empty-state CTA", () => {
    it("each module's own creation action opens its real form directly in a sheet, not an inline header + Link and not a one-item choice sheet that navigates", () => {
      const fabByModule = {
        budgets: ["src/app/(app)/finance/budgets/page.tsx", budgets, "AddBudgetFab"],
        installments: ["src/app/(app)/finance/installments/page.tsx", installments, "AddInstallmentFab"],
        debts: ["src/app/(app)/finance/debts/page.tsx", debts, "AddDebtFab"],
        goals: ["src/app/(app)/finance/goals/page.tsx", goals, "AddGoalFab"],
      } as const;
      for (const [name, [, source, marker]] of Object.entries(fabByModule)) {
        expect(source, `${name} should render <${marker}`).toContain(`<${marker}`);
        expect(source, `${name} header row must not carry an unconditional create Link right after <h1>`).not.toMatch(/<h1[^>]*>[^<]*<\/h1>\s*<Link/);
        // Pressing the FAB must never navigate — its own AsyncFormSheetButton
        // fetches supporting data JIT and renders the real form in place.
        expect(source, `${name} must not still reference the old FloatingActionButton`).not.toContain("FloatingActionButton");
      }
      // Each Fab component itself is the one place that knows the real
      // full-page route's data shape (via its own quick-add-data.ts
      // loader) — never re-fetched or hrefed from the list page.
      const budgetFab = read("src/features/budgets/components/AddBudgetFab.tsx");
      expect(budgetFab).toContain("getBudgetSheetData");
      expect(budgetFab).toContain("<CreateBudgetForm");
    });

    it("hides the FAB exactly when the empty state's own CTA would show", () => {
      expect(budgets).toContain("{active.length > 0 ? <AddBudgetFab");
      expect(installments).toContain("{active.length > 0 ? <AddInstallmentFab");
      expect(debts).toContain("{visible.length > 0 ? <AddDebtFab");
      expect(goals).toContain('{!(status === "active" && visible.length === 0) ? <AddGoalFab');
    });
  });

  it("gives every module page a Finance V2 empty state, never a bare floating CTA on blank space", () => {
    expect(budgets).toContain("<FinanceEmptyState");
    expect(installments).toContain("<FinanceEmptyState");
    expect(debts).toContain("<FinanceEmptyState");
    expect(goals).toContain("<FinanceEmptyState");
    expect(netWorth).toContain("<FinanceEmptyState");
    expect(reports).toContain("<FinanceEmptyState");
  });

  it("preserves every existing detail link target, and keeps the full-page /new routes alive as deep-link/fallback destinations even though the list page's own trigger no longer links to them", () => {
    expect(budgets).toContain("<BudgetCard"); // detail link itself lives in BudgetCard.tsx, unchanged
    expect(installments).toContain("/finance/installments/${plan.id}");
    expect(debts).toContain("/finance/debts/${debt.id}");
    expect(goals).toContain("/finance/goals/${goal.goalId}");

    expect(read("src/app/(app)/finance/budgets/new/page.tsx")).toContain("<CreateBudgetForm");
    expect(read("src/app/(app)/finance/installments/new/page.tsx")).toContain("<CreateInstallmentForm");
    expect(read("src/app/(app)/finance/debts/new/page.tsx")).toContain("<DebtCreateForm");
    expect(read("src/app/(app)/finance/goals/new/page.tsx")).toContain("<GoalForm");
  });

  it("derives Goals' progress entirely from the existing ledger/Pocket-derived RPC fields, never a recomputed or mutable field", () => {
    expect(goals).toContain("goal.isComplete");
    expect(goals).toContain("goal.progressPercent");
    expect(goals).not.toMatch(/progressPercent\s*=\s*Number/);
  });

  it("keeps LIABILITY vs RECEIVABLE debt semantics exactly as before — no new writer, no principal counted as income/expense", () => {
    expect(debts).toContain('debtType === direction');
    expect(debts).not.toMatch(/create_debt|record_debt|debt_events/);
  });

  it("keeps every module page's per-currency donut/bar visualization ratio-only (percentOfTotal for geometry, formatCurrency for the real amount)", () => {
    expect(reports).toContain("ratio: percentOfTotal(row.amount, total) / 100");
    expect(reports).toContain("formatCurrency(row.amount, row.currency)");
  });
});
