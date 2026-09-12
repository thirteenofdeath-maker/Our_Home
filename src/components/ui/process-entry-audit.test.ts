import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("BOTTOM SLIDE-UP invariant — only Create/Add ever opens a sliding sheet", () => {
  it("Wallets: Create Wallet — exactly one creation type, so the real WalletForm slides up directly (FormSheetButton), never a redundant one-item choice sheet and never a direct full-page link", () => {
    const source = read("src/app/(app)/wallets/page.tsx");
    expect(source).toContain("FormSheetButton");
    expect(source).toContain("<WalletForm");
    expect(source).toContain('variant="sheet"');
    expect(source).not.toMatch(/<Link href="\/wallets\/new"/);
    // This trigger lives inside the page's own .finance-scope wrapper —
    // the sheet must use finance tokens, not the generic ones.
    expect(source).toContain("finance-scope");
    expect(source).toContain('tone="finance"');
  });

  it("Wallets: Add Pocket (the wallet-detail manager-list trigger, AND the transfer/pocket empty-state CTA) — exactly one creation type, so the real AddPocketForm slides up directly, both now using finance tone since it's self-contained regardless of a .finance-scope ancestor", () => {
    const trigger = read("src/features/pockets/components/PocketCreateLink.tsx");
    expect(trigger).toContain("FormSheetButton");
    expect(trigger).toContain("<AddPocketForm walletId={walletId} variant=\"sheet\" />");
    expect(trigger).toContain('tone="finance"');

    // Finance tone is now self-contained (BottomSheet applies its own
    // `.finance-vars` directly on the dialog — see BottomSheet.tsx) so
    // this trigger uses tone="finance" too even though its host page is
    // NOT wrapped in `.finance-scope`.
    const emptyState = read("src/app/(app)/wallets/[walletId]/transfer/pocket/page.tsx");
    expect(emptyState).toContain("FormSheetButton");
    expect(emptyState).toContain("<AddPocketForm walletId={walletId} variant=\"sheet\" />");
    expect(emptyState).toContain('tone="finance"');
  });

  it("no Finance creation sheet is left on tone=\"default\" — every FormSheetButton/AsyncFormSheetButton reached from a Finance create trigger passes tone=\"finance\"", () => {
    const financeTriggers = [
      "src/app/(app)/wallets/page.tsx",
      "src/app/(app)/wallets/[walletId]/transfer/pocket/page.tsx",
      "src/features/pockets/components/PocketCreateLink.tsx",
      "src/features/budgets/components/AddBudgetFab.tsx",
      "src/features/goals/components/AddGoalFab.tsx",
      "src/features/installments/components/AddInstallmentFab.tsx",
      "src/features/debts/components/AddDebtFab.tsx",
      "src/features/bills/components/AddBillTrigger.tsx",
      "src/features/recurring/components/AddRecurringTrigger.tsx",
      "src/features/templates/components/CreateTemplateTrigger.tsx",
      "src/features/wallets/components/AddWalletTrigger.tsx",
    ];
    for (const path of financeTriggers) {
      const source = read(path);
      expect(source, `${path} should pass tone="finance"`).toContain('tone="finance"');
      expect(source, `${path} should never pass tone="default"`).not.toContain('tone="default"');
    }
  });

  it("BottomSheet's finance tone is self-contained: it applies its own .finance-vars class directly on the dialog, never relying solely on an ancestor .finance-scope", () => {
    const source = read("src/components/ui/BottomSheet.tsx");
    expect(source).toMatch(/tone === "finance" && "finance-vars"/);
  });

  it("Wallet detail's Income/Expense/Transfer cluster is an explicit, documented PROCESS_ENTRY_INLINE exception — not silently reclassified as normal navigation", () => {
    const source = read("src/app/(app)/wallets/[walletId]/page.tsx");
    expect(source).toContain("PROCESS_ENTRY_INLINE");
    // Still real, direct links to the real routes — the documented
    // exception is about NOT hiding them behind an extra sheet tap, not
    // about the routes themselves changing.
    expect(source).toContain("transactions/new?type=INCOME");
    expect(source).toContain("transactions/new?type=EXPENSE");
    expect(source).toMatch(/\$\{walletId\}\/transfer`/);
  });

  it("Bills: Add Bill opens the real BillForm directly in a sheet; Pay occurrence is a direct, always-visible Link — never a bottom-sliding menu for a Pay action", () => {
    const list = read("src/app/(app)/finance/bills/page.tsx");
    expect(list).toContain("<AddBillTrigger");
    const trigger = read("src/features/bills/components/AddBillTrigger.tsx");
    expect(trigger).toContain("<BillForm");
    expect(trigger).toContain("getBillSheetData");

    const occurrence = read("src/app/(app)/finance/bills/occurrences/[occurrenceId]/page.tsx");
    expect(occurrence).not.toMatch(/BottomSheet|ActionSheet|ActionMenuButton|AsyncFormSheetButton|FormSheetButton/);
    expect(occurrence).toMatch(/<Link href=\{`\/finance\/bills\/occurrences\/\$\{occurrenceId\}\/pay`\}/);
  });

  it("Recurring: Add recurring transaction opens the real CreateRecurringForm directly in a sheet; Use occurrence is a direct, always-visible Link", () => {
    const list = read("src/app/(app)/finance/recurring/page.tsx");
    expect(list).toContain("<AddRecurringTrigger");
    const trigger = read("src/features/recurring/components/AddRecurringTrigger.tsx");
    expect(trigger).toContain("<CreateRecurringForm");
    expect(trigger).toContain("getRecurringSheetData");

    const occurrence = read("src/app/(app)/finance/recurring/occurrences/[occurrenceId]/page.tsx");
    expect(occurrence).not.toMatch(/BottomSheet|ActionSheet|ActionMenuButton|AsyncFormSheetButton|FormSheetButton/);
    expect(occurrence).toMatch(/<Link href=\{useHref\}/);
  });

  it("Templates: Create Template opens the real CreateTemplateForm directly in a sheet (also from a transaction, with prefill — see the dedicated describe block below); Use Template is a direct, always-visible Link", () => {
    const list = read("src/app/(app)/finance/templates/page.tsx");
    expect(list).toContain("<CreateTemplateTrigger");
    const trigger = read("src/features/templates/components/CreateTemplateTrigger.tsx");
    expect(trigger).toContain("<CreateTemplateForm");
    expect(trigger).toContain("getTemplateSheetData");

    const detail = read("src/app/(app)/finance/templates/[templateId]/page.tsx");
    expect(detail).not.toMatch(/BottomSheet|ActionSheet|ActionMenuButton/);
    expect(detail).toMatch(/<Link href=\{useHref\}/);
  });

  it("Transactions: edit/refund/reimbursement are direct, always-visible Links (never a collapsing 'จัดการรายการ' bottom sheet) gated by the exact same remainingAdjustableAmount rule as before; 'สร้าง Template จากรายการนี้' alone opens the real create-form sheet since it IS a Create action", () => {
    const source = read("src/app/(app)/finance/transactions/[transactionId]/page.tsx");
    expect(source).not.toMatch(/ActionMenuButton|ActionSheet\b/);
    expect(source).toContain("จัดการรายการ"); // absent as a bottom-sheet title now, present only as the old comment-less label removed — see next assertion
    expect(source).not.toMatch(/sheetTitle="จัดการรายการ"/);
    expect(source).toMatch(/\/refund`\}[^]*?คืนเงิน/);
    expect(source).toMatch(/\/reimbursement`\}[^]*?เบิกคืน/);
    expect(source).toContain("Number(refundable.remainingAdjustableAmount) > 0");
    expect(source).toContain("<CreateTemplateTrigger");
    expect(source).toContain("fromTransactionId={transaction.transactionId}");
    // Void stays a SEPARATE, visually-danger confirmation — never mixed
    // into the safe-actions list.
    expect(source).toContain("<VoidTransactionForm");
  });

  it("never exposes an invalid transaction action: edit is omitted for adjustment transactions, refund/reimbursement are omitted once nothing remains adjustable", () => {
    const source = read("src/app/(app)/finance/transactions/[transactionId]/page.tsx");
    expect(source).toContain("const canEdit = !adjustmentOrigin;");
    expect(source).toContain("const canAdjust = isOriginalExpense && refundable && Number(refundable.remainingAdjustableAmount) > 0;");
  });

  it("Installments: an OPEN occurrence's 'จ่ายงวด' card is a direct Link to the existing /pay route — a Pay action never opens a bottom-sliding menu, even a single-item one", () => {
    const source = read("src/app/(app)/finance/installments/[planId]/page.tsx");
    expect(source).not.toMatch(/ActionMenuButton|ActionSheet|BottomSheet/);
    expect(source).toContain('x.status === "OPEN"');
    // The link still targets the EXACT pre-existing /pay route — this
    // correction only changes the trigger's interaction language, never
    // the destination, the payment form, or occurrence status logic.
    expect(source).toMatch(/<Link href=\{`\/finance\/installments\/occurrences\/\$\{x\.id\}\/pay`\}>\{cardContent\}<\/Link>/);
  });

  it("Installments: a PAID occurrence still navigates directly to its transaction detail — same plain-Link treatment as OPEN now gets, just a different destination", () => {
    const source = read("src/app/(app)/finance/installments/[planId]/page.tsx");
    const paidBranch = source.slice(source.indexOf('if (x.status === "OPEN")'));
    const afterOpenBranch = paidBranch.slice(paidBranch.indexOf("\n  }\n") + 5);
    expect(afterOpenBranch).toMatch(/<Link href=\{`\/finance\/transactions\/\$\{x\.paidTransactionId\}`\}>/);
  });

  it("Installments: no writer, domain, or occurrence-status logic changed — same api.ts selectors, same OPEN/PAID branching, no new query", () => {
    const source = read("src/app/(app)/finance/installments/[planId]/page.tsx");
    expect(source).toContain("getInstallmentPlan(supabase, planId)");
    expect(source).toContain("listInstallmentOccurrences(supabase, planId)");
    expect(source).not.toMatch(/\.rpc\(|\.from\(["'][a-z_]+["']\)/);
  });

  it("Debts: 'บันทึกการชำระ' (record payment) and 'เพิ่มเงินต้น' (add principal) are direct, always-visible Links — payment/principal on an EXISTING debt is never Create/Add, so it never opens a sheet of any kind", () => {
    const source = read("src/app/(app)/finance/debts/[debtId]/page.tsx");
    expect(source).not.toMatch(/ActionMenuButton|ActionSheet|BottomSheet/);
    expect(source).toMatch(/<Link href=\{`\/finance\/debts\/\$\{debtId\}\/payment`\}/);
    expect(source).toMatch(/<Link href=\{`\/finance\/debts\/\$\{debtId\}\/principal`\}/);
    // Archived debts still show no payment/principal actions at all —
    // same pre-existing gate, untouched.
    expect(source).toContain("d.archivedAt?");
  });
});

describe("Template-from-transaction quick-save is a real Create action — a form sheet with prefill, not a full-page-only exception", () => {
  it("getTemplateSheetData accepts an optional fromTransactionId and reproduces the full-page route's exact prefill rules", () => {
    const loader = read("src/features/templates/quick-add-data.ts");
    expect(loader).toMatch(/export async function getTemplateSheetData\(fromTransactionId\?:\s*string\)/);
    expect(loader).toContain("getTransactionDetail(supabase, fromTransactionId)");
    expect(loader).toContain("listTagsForTransaction(supabase, fromTransactionId!)");
    expect(loader).toContain("isEligibleSource");
    expect(loader).toContain("initialTransactionType");
    expect(loader).toContain("initialCategoryId");
    expect(loader).toContain("initialAmount");
  });

  it("the full-page /finance/templates/new route calls the SAME loader — no duplicated prefill logic", () => {
    const page = read("src/app/(app)/finance/templates/new/page.tsx");
    expect(page).toContain("getTemplateSheetData(fromTransactionId)");
    expect(page).not.toContain("getTransactionDetail"); // fetch itself lives only in the loader now
  });

  it("CreateTemplateTrigger accepts fromTransactionId and passes every initial* prefill field through to CreateTemplateForm", () => {
    const trigger = read("src/features/templates/components/CreateTemplateTrigger.tsx");
    expect(trigger).toContain("fromTransactionId?: string");
    expect(trigger).toContain("loadData={() => getTemplateSheetData(fromTransactionId)}");
    for (const field of [
      "initialScope",
      "initialTransactionType",
      "initialName",
      "initialWalletId",
      "initialPocketId",
      "initialCategoryId",
      "initialAmount",
      "initialTitle",
      "initialNote",
      "initialTagIds",
    ]) {
      expect(trigger, `should forward ${field}`).toContain(`${field}={data.${field}}`);
    }
  });

  it("the transaction detail page's 'สร้าง Template จากรายการนี้' passes the real transaction id into the sheet", () => {
    const source = read("src/app/(app)/finance/transactions/[transactionId]/page.tsx");
    expect(source).toMatch(/<CreateTemplateTrigger fromTransactionId=\{transaction\.transactionId\}/);
  });

  it("no template writer/business logic was duplicated — createTemplateAction is still defined exactly once", () => {
    const actions = read("src/features/templates/actions.ts");
    expect((actions.match(/export async function createTemplateAction/g) ?? []).length).toBe(1);
  });
});

describe("Category/Tag inline quick-create is a real two-stage sheet transition, never a second dialog on top of the picker", () => {
  it("CategoryPicker is a stage machine (pick/add) sharing ONE BottomSheet, transitioning via the same close-then-reopen pattern as FinanceCreateFlow", () => {
    const source = read("src/features/categories/components/CategoryPicker.tsx");
    expect((source.match(/<BottomSheet/g) ?? []).length).toBe(1);
    expect(source).toContain('import { BottomSheet, CLOSE_TRANSITION_MS } from "@/components/ui/BottomSheet"');
    expect(source).toMatch(/function transitionTo\(next: \(\) => void\) \{\s*setSheetOpen\(false\);\s*setTimeout\(next, CLOSE_TRANSITION_MS\);/);
    expect(source).toContain('type Stage = "pick" | "add"');
    expect(source).toContain("openAddForm");
    expect(source).toContain("backToPicker");
  });

  it("CategoryPicker's quick-create still calls the exact existing createCategoryAction — never a forked writer — and revalidates via router.refresh() before returning to the picker", () => {
    const source = read("src/features/categories/components/CategoryPicker.tsx");
    expect(source).toContain("createCategoryAction(initialActionState, formData)");
    expect(source).toContain("router.refresh()");
    expect(source).toContain("backToPicker()");
    const actions = read("src/features/categories/actions.ts");
    expect((actions.match(/export async function createCategoryAction/g) ?? []).length).toBe(1);
  });

  it("TagPicker is a stage machine (pick/add) sharing ONE BottomSheet, transitioning via the same close-then-reopen pattern", () => {
    const source = read("src/features/tags/components/TagPicker.tsx");
    expect((source.match(/<BottomSheet/g) ?? []).length).toBe(1);
    expect(source).toContain('import { BottomSheet, CLOSE_TRANSITION_MS } from "@/components/ui/BottomSheet"');
    expect(source).toMatch(/function transitionTo\(next: \(\) => void\) \{\s*setSheetOpen\(false\);\s*setTimeout\(next, CLOSE_TRANSITION_MS\);/);
    expect(source).toContain('type Stage = "pick" | "add"');
    expect(source).toContain("openAddForm");
    expect(source).toContain("backToPicker");
  });

  it("TagPicker's quick-create still calls the exact existing createTagAction — never a forked writer — and revalidates via router.refresh() before returning to the picker", () => {
    const source = read("src/features/tags/components/TagPicker.tsx");
    expect(source).toContain("createTagAction(initialActionState, formData)");
    expect(source).toContain("router.refresh()");
    expect(source).toContain("backToPicker()");
    const actions = read("src/features/tags/actions.ts");
    expect((actions.match(/export async function createTagAction/g) ?? []).length).toBe(1);
  });

  it("standalone /categories and /finance/tags inline forms are untouched — no creation trigger exists there to animate", () => {
    const categoriesPage = read("src/app/(app)/categories/page.tsx");
    expect(categoriesPage).toContain("<AddCategoryForm");
    const tagsPage = read("src/app/(app)/finance/tags/page.tsx");
    expect(tagsPage).toContain("<AddTagForm");
  });
});

describe("Existing destructive confirmations are unaffected by the process-entry correction", () => {
  const destructiveConsumers = [
    "src/features/wallets/components/WalletLifecycleControls.tsx",
    "src/features/pockets/components/PocketManagerList.tsx",
    "src/features/transactions/components/VoidTransactionForm.tsx",
    "src/features/bills/components/SkipBillForm.tsx",
    "src/features/recurring/components/SkipOccurrenceForm.tsx",
  ];

  it("wallet archive/delete, pocket delete, transaction void, bill/recurring skip still use ConfirmDialog", () => {
    for (const path of destructiveConsumers) {
      expect(read(path), path).toContain("ConfirmDialog");
    }
  });

  // Section 7 of the task: destructive confirmations must NOT visually
  // masquerade as the Create/Add slide-up flow — ConfirmDialog is a
  // centered, native-<dialog>-based card (fade+scale), never built on
  // BottomSheet's bottom-anchored slide-up motion.
  it("no destructive confirmation consumer imports the sliding BottomSheet directly — ConfirmDialog is the only thing they compose", () => {
    for (const path of destructiveConsumers) {
      expect(read(path), path).not.toContain("BottomSheet");
    }
  });

  it("ConfirmDialog itself never uses BottomSheet or its slide-up motion — centered fade+scale only, no translate3d bottom-entry", () => {
    const source = read("src/components/ui/ConfirmDialog.tsx");
    expect(source).not.toMatch(/import\s*\{[^}]*BottomSheet/);
    expect(source).not.toContain("<BottomSheet");
    expect(source).not.toMatch(/translate3d\(0,\s*100%,\s*0\)/);
    expect(source).toContain("fixed inset-0 m-auto");
    expect(source).toMatch(/scale-95|scale-100/);
  });
});

describe("Normal navigation remains immediate — not converted merely for consistency", () => {
  it("BottomNav and FinanceModuleTabs stay plain links with no sheet/menu component", () => {
    for (const path of ["src/components/shared/BottomNav.tsx", "src/features/finance/components/FinanceModuleTabs.tsx"]) {
      const source = read(path);
      expect(source, path).not.toMatch(/ActionMenuButton|ActionSheet|BottomSheet/);
    }
  });

  it("reversible archive/restore/pause/resume toggles stay plain forms — not converted to a sheet", () => {
    const recurringLifecycle = read("src/features/recurring/components/RecurringLifecycleActions.tsx");
    expect(recurringLifecycle).not.toMatch(/ActionMenuButton|BottomSheet/);
    const budgetsPage = read("src/app/(app)/finance/budgets/[budgetId]/page.tsx");
    expect(budgetsPage).not.toMatch(/ActionMenuButton|BottomSheet/);
  });
});

describe("ActionMenuButton and ActionSheet no longer exist in the codebase", () => {
  it("both files were deleted rather than left as unused dead abstractions", () => {
    expect(() => read("src/components/ui/ActionMenuButton.tsx")).toThrow();
    expect(() => read("src/components/ui/ActionSheet.tsx")).toThrow();
  });
});
