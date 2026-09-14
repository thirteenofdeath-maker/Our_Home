import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));

import { TransactionForm } from "./TransactionForm";

const source = readFileSync(resolve(process.cwd(), "src/features/transactions/components/TransactionForm.tsx"), "utf8");

const wallets = [
  { id: "wallet-a", name: "KBank", currency: "THB", scope: "PERSONAL" as const },
  { id: "wallet-b", name: "SCB", currency: "THB", scope: "PERSONAL" as const },
];
const pockets = [{ id: "pocket-1", name: "Main", sort_order: 0 } as never];
const categories = [{ id: "cat-1", name: "Food", parent_id: null, transaction_type: "EXPENSE", is_system: false, children: [] } as never];
const tags = [{ id: "tag-1", name: "fun" } as never];

describe("TransactionForm — renders in both variants without crashing", () => {
  it.each(["page", "sheet"] as const)("variant=%s", (variant) => {
    const html = renderToStaticMarkup(
      createElement(TransactionForm, {
        walletId: "wallet-a",
        wallets,
        transactionType: "EXPENSE",
        pockets,
        categories,
        tags,
        variant,
      }),
    );
    expect(html).toContain("กระเป๋าเงิน (Wallet)");
    expect(html).toContain("ช่องเงิน (Pocket)");
  });
});

describe("TransactionForm — in-sheet wallet switch stays inside the same form sheet", () => {
  it("passes onWalletChange to TransactionWalletSelect only in variant=\"sheet\" — variant=\"page\" keeps the original router.replace navigation", () => {
    expect(source).toContain('onWalletChange={variant === "sheet" ? handleWalletChange : undefined}');
  });

  it("re-fetches Pocket/Category/Tag data through the exact same selector used by the full-page route and FinanceCreateFlow — never a new/duplicated query", () => {
    expect(source).toContain('import { getIncomeExpenseSheetData } from "@/features/finance/quick-add-data"');
    expect(source).toContain("await getIncomeExpenseSheetData(nextWalletId, transactionType)");
  });

  it("never calls router.push/replace itself when switching wallets in-sheet — only local state changes", () => {
    const handler = source.slice(source.indexOf("function handleWalletChange"), source.indexOf("function handleWalletChange") + 500);
    expect(handler).not.toContain("router.");
    expect(handler).not.toContain(".push(");
    expect(handler).not.toContain(".replace(");
  });

  it("a failed re-fetch surfaces a real error and leaves the form mounted — never a silent crash or forced navigation", () => {
    expect(source).toMatch(/catch \{\s*setWalletSwitchError\(/);
    expect(source).toContain("walletSwitchError");
  });

  it("resets Pocket/Category/Tag selections when the wallet changes — remounting via key={activeWalletId} so no stale id from the old wallet survives", () => {
    expect(source).toMatch(/<Select key=\{activeWalletId\} id="pocketId"/);
    expect(source).toMatch(/<CategoryPicker\s*\n\s*key=\{activeWalletId\}/);
    expect(source).toMatch(/<TagPicker key=\{activeWalletId\}/);
  });

  it("Template/Recurring prefill defaults only apply while still on the original wallet — dropped after switching, never carried over as a stale id", () => {
    expect(source).toContain("const onOriginalWallet = activeWalletId === walletId;");
    expect(source).toContain("onOriginalWallet ? defaultPocketId : null");
    expect(source).toContain("onOriginalWallet && defaultCategoryId");
    expect(source).toContain("onOriginalWallet ? defaultTagIds : undefined");
  });

  it("the hidden walletId field submits the ACTIVE (possibly switched) wallet, not the original mount-time prop", () => {
    // effectiveWalletId falls back to activeWalletId outside the Phase U
    // (0051) household-expense flow — see isHouseholdExpenseFlow — so
    // behavior for every existing caller (INCOME, Template/Recurring
    // prefill, the quick-add sheet) is unchanged.
    expect(source).toContain('<input type="hidden" name="walletId" value={effectiveWalletId} />');
    expect(source).toContain("const effectiveWalletId = isHouseholdExpenseFlow && expenseScope === \"HOUSEHOLD\" ? householdFundingWalletId : activeWalletId;");
  });

  it("disables the wallet select while a switch is in flight, preventing a duplicate change mid-fetch", () => {
    expect(source).toContain("disabled={walletSwitchPending}");
  });
});

// ---------------------------------------------------------------------
// Phase U (0051): Personal-Funded Household Expense — explicit scope.
// ---------------------------------------------------------------------

const householdExpenseContext = {
  household: { id: "household-1", name: "บ้านสุขสันต์" },
  payerDisplayName: "สมชาย",
  householdCategories: [{ id: "hh-cat-1", name: "ค่าไฟ", parent_id: null, transaction_type: "EXPENSE", is_system: false, children: [] } as never],
  householdWallets: [{ id: "wallet-hh", name: "บัญชีครอบครัว", currency: "THB" }],
  personalWallets: [{ id: "wallet-a", name: "KBank", currency: "THB" }],
  pocketsByWallet: {
    "wallet-hh": [{ id: "pocket-hh", name: "หลัก", sort_order: 0 } as never],
    "wallet-a": [{ id: "pocket-1", name: "Main", sort_order: 0 } as never],
  },
};

describe("TransactionForm — Phase U explicit household-expense scope (0051)", () => {
  it("renders with no scope preselected when householdExpenseContext is supplied for an EXPENSE", () => {
    const html = renderToStaticMarkup(
      createElement(TransactionForm, {
        walletId: "wallet-a",
        wallets,
        transactionType: "EXPENSE",
        pockets,
        categories,
        tags,
        householdExpenseContext,
      }),
    );
    expect(html).toContain("รายการนี้เป็นของใคร?");
    // Neither ส่วนตัว nor ครอบครัว renders as the checked/selected radio —
    // both option buttons share the exact same unselected className.
    expect(html).not.toContain("border-2 border-primary bg-primary-soft");
  });

  it("is gated to plain EXPENSE creation only — never for INCOME, a Template prefill, or a Recurring occurrence post", () => {
    expect(source).toContain(
      "const isHouseholdExpenseFlow = Boolean(householdExpenseContext) && transactionType === \"EXPENSE\" && !postOccurrence && !templateId;",
    );
  });

  it("routes to createExpenseAction (never createIncomeExpenseAction) once the household-expense flow is active", () => {
    expect(source).toContain("postOccurrence ? postRecurringOccurrenceAction : isHouseholdExpenseFlow ? createExpenseAction : createIncomeExpenseAction");
  });

  it("blocks submission (disables the submit button) until a scope is chosen", () => {
    expect(source).toContain(
      "const canSubmit = !isHouseholdExpenseFlow || (expenseScope === \"PERSONAL\" && Boolean(activeWalletId)) || (expenseScope === \"HOUSEHOLD\" && Boolean(householdFundingWalletId));",
    );
    expect(source).toContain("{...(!canSubmit ? { disabled: true } : {})}");
  });

  it("never defaults expenseScope from anything — starts at null, independent of the Finance dashboard's own view filter", () => {
    expect(source).toContain('useState<ExpenseScope | null>(null)');
  });

  it("shows the combined funding-wallet selector (household + the payer's own personal wallets) only once ครอบครัว is chosen", () => {
    expect(source).toContain("isHouseholdExpenseFlow && expenseScope === \"HOUSEHOLD\" ? (\n        <HouseholdExpenseFundingSelect");
  });

  it("uses the household category tree (categoryScope=\"HOUSEHOLD\"), not a per-wallet category list, once ครอบครัว is chosen", () => {
    expect(source).toContain('categories={householdExpenseContext!.householdCategories}');
    expect(source).toContain('categoryScope="HOUSEHOLD"');
  });

  it("hides the tag picker whenever ครอบครัว is chosen (V1: personal tags are never shown for a household expense created this way)", () => {
    expect(source).toContain('{!(isHouseholdExpenseFlow && expenseScope === "HOUSEHOLD") ? (');
  });

  it("shows the explanatory note only for the ATTRIBUTED combination (household scope + a personal funding wallet), not for a plain household-wallet expense", () => {
    expect(source).toContain("จ่ายจากกระเป๋าส่วนตัวแทนครอบครัว");
    expect(source).toContain(
      "householdExpenseContext!.personalWallets.some((wallet) => wallet.id === householdFundingWalletId);",
    );
  });
});
