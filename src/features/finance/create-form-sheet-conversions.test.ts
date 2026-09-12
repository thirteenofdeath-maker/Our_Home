import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
// Strips /** ... */ and // ... comments before substring checks, so a
// doc comment explaining what a file deliberately does NOT do (e.g.
// "no tone=\"finance\"" or "replaces the previous ActionMenuButton")
// can't be mistaken for actual code doing that thing.
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// Every reusable create form gained a `variant?: "page" | "sheet"` prop —
// presentation only, same Server Action/validation/fields either way.
// Some of these forms never had page-level card chrome to strip in the
// first place (unlike WalletForm/AddPocketForm), so their `variant`
// branch is a documented no-op kept for API-consistency, not a bug.
describe("Every converted create form accepts variant=\"page\"|\"sheet\" without forking business logic", () => {
  const forms: Array<[string, string]> = [
    ["src/features/budgets/components/CreateBudgetForm.tsx", "createBudgetAction"],
    ["src/features/goals/components/GoalForm.tsx", "saveGoalAction"],
    ["src/features/installments/components/CreateInstallmentForm.tsx", "createInstallmentPlanAction"],
    ["src/features/debts/components/DebtForms.tsx", "createDebtAction"],
    ["src/features/bills/components/BillForm.tsx", "createBillAction"],
    ["src/features/recurring/components/CreateRecurringForm.tsx", "createRecurringAction"],
    ["src/features/templates/components/CreateTemplateForm.tsx", "createTemplateAction"],
    ["src/features/pets/components/PetForm.tsx", "createPetAction"],
    ["src/features/calendar/components/CalendarEventForm.tsx", "createCalendarEventAction"],
    ["src/features/household/components/CreateHouseholdForm.tsx", "createHouseholdAction"],
    ["src/features/household/components/AddMemberForm.tsx", "addHouseholdMemberAction"],
  ];

  for (const [path, actionName] of forms) {
    it(`${path} has a variant prop and still calls the exact same existing ${actionName}`, () => {
      const source = read(path);
      expect(source, path).toMatch(/variant\??:\s*"page"\s*\|\s*"sheet"/);
      expect(source, path).toContain(actionName);
    });
  }
});

describe("Full-page /new (and equivalent) routes still render, unmodified in business logic, as deep-link/fallback routes", () => {
  const routes: Array<[string, string]> = [
    ["src/app/(app)/finance/budgets/new/page.tsx", "<CreateBudgetForm"],
    ["src/app/(app)/finance/goals/new/page.tsx", "<GoalForm"],
    ["src/app/(app)/finance/installments/new/page.tsx", "<CreateInstallmentForm"],
    ["src/app/(app)/finance/debts/new/page.tsx", "<DebtCreateForm"],
    ["src/app/(app)/finance/bills/new/page.tsx", "<BillForm"],
    ["src/app/(app)/finance/recurring/new/page.tsx", "<CreateRecurringForm"],
    ["src/app/(app)/finance/templates/new/page.tsx", "<CreateTemplateForm"],
    ["src/app/(app)/pets/new/page.tsx", "<PetForm"],
    ["src/app/(app)/calendar/new/page.tsx", "<CalendarEventForm"],
    ["src/app/(app)/household/new/page.tsx", "<CreateHouseholdForm"],
    ["src/app/(app)/household/members/page.tsx", "<AddMemberForm"],
  ];

  for (const [path, marker] of routes) {
    it(`${path} still renders ${marker}`, () => {
      expect(read(path), path).toContain(marker);
    });
  }
});

describe("Non-Finance modules (Pet, Calendar, Household) never adopt Finance V2 tone", () => {
  it("AddPetFab and AddCalendarEventFab never pass tone=\"finance\"", () => {
    expect(stripComments(read("src/features/pets/components/AddPetFab.tsx"))).not.toContain('tone="finance"');
    expect(stripComments(read("src/features/calendar/components/AddCalendarEventFab.tsx"))).not.toContain('tone="finance"');
  });

  it("Household's FormSheetButton usages never pass tone=\"finance\" either", () => {
    const source = read("src/app/(app)/household/page.tsx");
    expect(source).not.toContain('tone="finance"');
  });
});

describe("Finance create sheets DO use finance tone", () => {
  const fabs = [
    "src/features/budgets/components/AddBudgetFab.tsx",
    "src/features/goals/components/AddGoalFab.tsx",
    "src/features/installments/components/AddInstallmentFab.tsx",
    "src/features/debts/components/AddDebtFab.tsx",
    "src/features/bills/components/AddBillTrigger.tsx",
    "src/features/recurring/components/AddRecurringTrigger.tsx",
    "src/features/templates/components/CreateTemplateTrigger.tsx",
  ];
  for (const path of fabs) {
    it(`${path} passes tone="finance"`, () => {
      expect(read(path), path).toContain('tone="finance"');
    });
  }
});

describe("Single creation type never shows a redundant one-item choice sheet", () => {
  const fabs = [
    "src/features/budgets/components/AddBudgetFab.tsx",
    "src/features/goals/components/AddGoalFab.tsx",
    "src/features/installments/components/AddInstallmentFab.tsx",
    "src/features/debts/components/AddDebtFab.tsx",
    "src/features/bills/components/AddBillTrigger.tsx",
    "src/features/recurring/components/AddRecurringTrigger.tsx",
    "src/features/templates/components/CreateTemplateTrigger.tsx",
    "src/features/pets/components/AddPetFab.tsx",
    "src/features/calendar/components/AddCalendarEventFab.tsx",
  ];
  for (const path of fabs) {
    it(`${path} never renders ActionSheet/ActionMenuButton/FloatingActionButton — the real form is the only thing that slides up`, () => {
      const source = stripComments(read(path));
      expect(source, path).not.toContain("ActionSheet");
      expect(source, path).not.toContain("ActionMenuButton");
      expect(source, path).not.toContain("FloatingActionButton");
    });
  }
});

describe("Non-create workflows were NOT converted to the creation form-sheet pattern — no bottom slide-up for Pay/Refund/Reimbursement/Use/Edit/Manage", () => {
  it("Pay (bill/installment occurrence, debt payment/principal), Use Template/Recurring stay plain, always-visible Links — no ActionMenuButton (deleted), no BottomSheet, no FormSheetButton/AsyncFormSheetButton", () => {
    const cases = [
      "src/app/(app)/finance/bills/occurrences/[occurrenceId]/page.tsx",
      "src/app/(app)/finance/installments/[planId]/page.tsx",
      "src/app/(app)/finance/debts/[debtId]/page.tsx",
      "src/app/(app)/finance/recurring/occurrences/[occurrenceId]/page.tsx",
      "src/app/(app)/finance/templates/[templateId]/page.tsx",
    ];
    for (const path of cases) {
      const source = read(path);
      expect(source, path).not.toMatch(/ActionMenuButton|ActionSheet|BottomSheet|AsyncFormSheetButton|FormSheetButton/);
      expect(source, `${path} should still render at least one <Link`).toContain("<Link");
    }
  });

  it("Transactions detail: edit/refund/reimbursement are plain Links (no sheet); the one legitimate Create action ('สร้าง Template จากรายการนี้') is isolated to CreateTemplateTrigger, not a bare sheet primitive referenced directly on this page", () => {
    const source = read("src/app/(app)/finance/transactions/[transactionId]/page.tsx");
    expect(source).not.toMatch(/ActionMenuButton|ActionSheet\b|AsyncFormSheetButton|FormSheetButton/);
    expect(source).toContain("<CreateTemplateTrigger");
  });
});

describe("Secondary wallet/household creation prompts elsewhere in the app also open the real form directly, never a bare /new link", () => {
  it("Finance Hub's zero-wallet and zero-budget dashboard rows reuse the exact same triggers as the Wallets/Budgets list pages — no separate implementation", () => {
    const hub = read("src/app/(app)/finance/page.tsx");
    expect(hub).toContain("<AddWalletTrigger");
    expect(hub).toContain("<AddBudgetFab");
    expect(hub).toContain("asHubCard");
    expect(hub).not.toContain('"/wallets/new"');
    expect(hub).not.toContain('"/finance/budgets/new"');
  });

  it("the 'no eligible wallet' fallback inside Use-Template and Use-Recurring-Occurrence flows opens WalletForm directly instead of navigating away to a separate page", () => {
    const cases = [
      "src/app/(app)/finance/templates/[templateId]/use/page.tsx",
      "src/app/(app)/finance/recurring/occurrences/[occurrenceId]/use/page.tsx",
    ];
    for (const path of cases) {
      const source = read(path);
      expect(source, path).toContain("<AddWalletTrigger");
      expect(source, path).not.toContain('"/wallets/new"');
    }
  });

  it("Onboarding's two creation cards ('สร้างกระเป๋าเงินส่วนตัว', 'สร้างครอบครัว') open their real forms directly, sharing the exact same triggers used elsewhere — no separate onboarding-only implementation", () => {
    const source = read("src/app/(app)/onboarding/page.tsx");
    expect(source).toContain("<AddWalletTrigger");
    expect(source).toContain("<AddHouseholdTrigger");
    expect(source).not.toContain('"/wallets/new?scope=PERSONAL"');
    expect(source).not.toContain('"/household/new"');
  });

  it("AddWalletTrigger and AddHouseholdTrigger are each defined once and reused by every call site — never re-implemented per page", () => {
    const walletTrigger = read("src/features/wallets/components/AddWalletTrigger.tsx");
    expect(walletTrigger).toContain("<WalletForm");
    expect(walletTrigger).toContain("getCreateWalletSheetData");
    const householdTrigger = read("src/features/household/components/AddHouseholdTrigger.tsx");
    expect(householdTrigger).toContain("<CreateHouseholdForm");

    const consumers = [
      "src/app/(app)/finance/page.tsx",
      "src/app/(app)/finance/templates/[templateId]/use/page.tsx",
      "src/app/(app)/finance/recurring/occurrences/[occurrenceId]/use/page.tsx",
      "src/app/(app)/onboarding/page.tsx",
    ];
    for (const path of consumers) {
      const source = stripComments(read(path));
      expect(source, path).not.toContain("<WalletForm");
    }
  });
});
