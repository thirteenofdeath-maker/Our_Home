import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// Any file that composes BottomSheet must never define its own
// transition/transform/duration classes — that would be a second,
// parallel animation implementation, which the task explicitly forbids.
// A bare "duration-" match would also catch BottomSheet's own file if
// misused, so this only ever runs against BottomSheet's *consumers*.
function hasOwnAnimationClasses(source: string): boolean {
  return /transition-\[|duration-\[\d+ms\]|\[transform:translate3d/.test(source);
}

describe("One shared motion system — every action/process sheet reuses BottomSheet's animation, never a second implementation", () => {
  it("the Transaction filter sheet, CategoryPicker, and TagPicker all render the real BottomSheet with no independent animation of their own", () => {
    const consumers = [
      "src/features/transactions/components/FinanceFilterSheet.tsx",
      "src/features/categories/components/CategoryPicker.tsx",
      "src/features/tags/components/TagPicker.tsx",
    ];
    for (const path of consumers) {
      const source = read(path);
      expect(source, `${path} should import BottomSheet`).toMatch(/import\s*\{\s*BottomSheet[\s,}]/);
      expect(source, `${path} should render <BottomSheet`).toContain("<BottomSheet");
      expect(hasOwnAnimationClasses(source), `${path} should not define its own transition/transform animation`).toBe(false);
    }
  });

  it("CategoryPicker and TagPicker reuse CLOSE_TRANSITION_MS for their own pick/add stage transitions — never a second, independent timing value", () => {
    for (const path of ["src/features/categories/components/CategoryPicker.tsx", "src/features/tags/components/TagPicker.tsx"]) {
      const source = read(path);
      expect(source, path).toMatch(/import\s*\{\s*BottomSheet,\s*CLOSE_TRANSITION_MS\s*\}/);
      expect(source, path).not.toMatch(/CLOSE_TRANSITION_MS\s*=\s*\d+/);
    }
  });

  // FloatingActionButton (a fixed FAB that opened a one-item ActionSheet
  // whose single row just navigated) was the "redundant one-item choice
  // sheet in front of a plain link" anti-pattern the create/add rework
  // eliminated — every one of its former consumers now renders the real
  // create form directly via FormSheetButton/AsyncFormSheetButton. With
  // no remaining callers, the component itself was deleted rather than
  // left as unused dead code.
  it("FloatingActionButton no longer exists — every former single-create consumer now opens its real form directly via FormSheetButton/AsyncFormSheetButton", () => {
    expect(() => read("src/components/ui/FloatingActionButton.tsx")).toThrow();

    const pagesConvertedToFormSheets: Array<[string, string]> = [
      ["src/app/(app)/finance/budgets/page.tsx", "AddBudgetFab"],
      ["src/app/(app)/finance/installments/page.tsx", "AddInstallmentFab"],
      ["src/app/(app)/finance/debts/page.tsx", "AddDebtFab"],
      ["src/app/(app)/finance/goals/page.tsx", "AddGoalFab"],
      ["src/app/(app)/pets/page.tsx", "AddPetFab"],
      ["src/app/(app)/pets/[petId]/page.tsx", "AddPetFab"],
      ["src/app/(app)/calendar/page.tsx", "AddCalendarEventFab"],
      ["src/app/(app)/calendar/[eventId]/page.tsx", "AddCalendarEventFab"],
      ["src/app/(app)/household/page.tsx", "FormSheetButton"],
    ];
    for (const [path, marker] of pagesConvertedToFormSheets) {
      const source = read(path);
      expect(source, `${path} should render <${marker}`).toContain(`<${marker}`);
      expect(source, `${path} should not still reference FloatingActionButton`).not.toContain("FloatingActionButton");
      expect(hasOwnAnimationClasses(source), `${path} should not define its own sheet animation`).toBe(false);
    }
  });

  it("GlobalQuickAdd (Finance's own quick-add FAB) reaches BottomSheet through FinanceCreateFlow/FormSheetButton instead — a different chain for a different interaction (multi-stage forms, not navigating items), but still only ONE low-level sheet implementation, never its own", () => {
    const source = read("src/components/shared/GlobalQuickAdd.tsx");
    expect(hasOwnAnimationClasses(source)).toBe(false);
    const flow = read("src/features/finance/components/FinanceCreateFlow.tsx");
    expect(flow).toMatch(/import\s*\{\s*BottomSheet,\s*CLOSE_TRANSITION_MS\s*\}/);
    expect(hasOwnAnimationClasses(flow)).toBe(false);
    const formSheetButton = read("src/components/ui/FormSheetButton.tsx");
    expect(formSheetButton).toContain('import { BottomSheet } from "@/components/ui/BottomSheet"');
    expect(hasOwnAnimationClasses(formSheetButton)).toBe(false);
  });

  it("BottomSheet is the ONLY file in the component library defining this animation's transition/duration/transform values", () => {
    // A single source of truth: exactly one file owns `duration-[240ms]`
    // (or any other literal duration used for this system) as an actual
    // style declaration, not merely a reference in a comment.
    const bottomSheet = read("src/components/ui/BottomSheet.tsx");
    expect(bottomSheet).toMatch(/duration-\[\d+ms\]/);

    for (const path of [
      "src/components/ui/FormSheetButton.tsx",
      "src/components/ui/AsyncFormSheetButton.tsx",
      "src/features/finance/components/FinanceCreateFlow.tsx",
      "src/features/transactions/components/FinanceFilterSheet.tsx",
      "src/features/categories/components/CategoryPicker.tsx",
      "src/features/tags/components/TagPicker.tsx",
    ]) {
      expect(read(path), `${path} must not redeclare a duration-[Nms] class`).not.toMatch(/duration-\[\d+ms\]/);
    }
  });
});

// Destructive/high-consequence confirmations are a deliberate SECOND,
// intentionally-different motion language — a centered fade+scale card,
// never the bottom-sheet slide-up reserved for Create/Add. ConfirmDialog
// is that system's own single shared implementation (every destructive
// consumer composes it, none re-implements the motion itself), the same
// "one owner of the animation values" rule BottomSheet enforces for the
// slide-up system above — just a second, clearly-distinct system, not a
// violation of "never a second implementation of the SAME motion".
describe("Destructive confirmations use their own single, centered motion — never the Create/Add slide-up", () => {
  it("ConfirmDialog does not compose BottomSheet and does not use its slide-up transform — a centered fade+scale card instead", () => {
    const source = read("src/components/ui/ConfirmDialog.tsx");
    expect(source).not.toMatch(/import\s*\{[^}]*BottomSheet/);
    expect(source).not.toContain("<BottomSheet");
    expect(source).not.toMatch(/\[transform:translate3d\(0,\s*100%,\s*0\)\]/);
    expect(source).toMatch(/scale-95/);
    expect(source).toContain("useActionState(action, initialActionState)");
    expect(source).toContain("state.error");
  });

  it("ConfirmDialog is the ONLY file defining this centered-dialog animation's duration — every consumer reuses it, none redeclares its own", () => {
    const consumers = [
      "src/features/wallets/components/WalletLifecycleControls.tsx",
      "src/features/pockets/components/PocketManagerList.tsx",
      "src/features/transactions/components/VoidTransactionForm.tsx",
      "src/features/bills/components/SkipBillForm.tsx",
      "src/features/recurring/components/SkipOccurrenceForm.tsx",
    ];
    const confirmDialog = read("src/components/ui/ConfirmDialog.tsx");
    expect(confirmDialog).toMatch(/duration-\[\d+ms\]/);
    for (const path of consumers) {
      expect(read(path), `${path} must not redeclare a duration-[Nms] class`).not.toMatch(/duration-\[\d+ms\]/);
    }
  });

  it("every destructive/high-consequence confirmation reuses ConfirmDialog with its OWN existing Server Action — never a new one", () => {
    const consumers: Array<[string, string]> = [
      ["src/features/wallets/components/WalletLifecycleControls.tsx", "deleteWalletAction"],
      ["src/features/wallets/components/WalletLifecycleControls.tsx", "archiveWalletAction"],
      ["src/features/transactions/components/VoidTransactionForm.tsx", "voidTransactionAction"],
      ["src/features/bills/components/SkipBillForm.tsx", "skipBillAction"],
      ["src/features/recurring/components/SkipOccurrenceForm.tsx", "skipOccurrenceAction"],
      ["src/features/pockets/components/PocketManagerList.tsx", "deletePocketAction"],
    ];
    for (const [path, actionName] of consumers) {
      const source = read(path);
      expect(source, `${path} should import ConfirmDialog`).toContain("ConfirmDialog");
      expect(source, `${path} should still invoke ${actionName}`).toContain(actionName);
      expect(hasOwnAnimationClasses(source), `${path} should not define its own dialog animation`).toBe(false);
    }
  });
});

describe("Navigation itself never slides — only Create/Add sheets do", () => {
  it("BottomNav is plain navigation with no transition/transform animation classes", () => {
    const source = read("src/components/shared/BottomNav.tsx");
    expect(hasOwnAnimationClasses(source)).toBe(false);
    // The only "transition" it uses is a plain color transition on the
    // active/inactive tab state, never a positional/opacity one.
    expect(source).not.toMatch(/transition-\[transform/);
  });

  it("FinanceModuleTabs (header module nav) has no slide/transform transition of its own", () => {
    const source = read("src/features/finance/components/FinanceModuleTabs.tsx");
    expect(hasOwnAnimationClasses(source)).toBe(false);
  });
});
