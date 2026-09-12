import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
// Strips comments before substring checks, so a doc comment explaining
// what a file deliberately does NOT do (e.g. "no tone=\"finance\"")
// can't be mistaken for actual code doing that thing.
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const globals = read("src/app/globals.css");
const field = read("src/components/ui/Field.tsx");
const button = read("src/components/ui/Button.tsx");

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;

describe("Finance UI tone architecture — globals.css", () => {
  it("defines .finance-ui-tone by remapping the SAME generic --color-* custom properties Field/Input/Select/Textarea/Button already read — no new hex values, only var() references to existing --finance-* tokens", () => {
    // .finance-ui-tone appears twice: once in the shared selector list
    // with .finance-vars/.finance-scope (raw --finance-* definitions),
    // and once standalone (the --color-* remap block this test checks)
    // — pick the block that actually contains a --color- property.
    const blocks = [...globals.matchAll(/\.finance-ui-tone\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const body = blocks.find((b) => b.includes("--color-"));
    expect(body, "expected a standalone .finance-ui-tone block with --color-* remaps").toBeTruthy();
    for (const [prop, target] of [
      ["--color-background", "--finance-background"],
      ["--color-surface", "--finance-surface-strong"],
      ["--color-surface-muted", "--finance-background"],
      ["--color-border", "--finance-primary-soft"],
      ["--color-foreground", "--finance-text"],
      ["--color-foreground-muted", "--finance-muted"],
      ["--color-primary", "--finance-primary"],
      ["--color-primary-soft", "--finance-primary-soft"],
    ]) {
      expect(body, `${prop} should map to var(${target})`).toMatch(new RegExp(`${prop}:\\s*var\\(${target}\\)`));
    }
    expect(body).not.toMatch(HEX_COLOR);
  });

  it("never remaps --color-danger/--color-danger-foreground — validation/destructive styling stays semantically distinct from the Finance palette", () => {
    const blocks = [...globals.matchAll(/\.finance-ui-tone\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const body = blocks.find((b) => b.includes("--color-"))!;
    expect(body).not.toContain("--color-danger");
  });

  it(".finance-ui-tone is self-contained — it also carries the raw --finance-* variable definitions (via the shared selector with .finance-vars/.finance-scope), so a full-page route with no .finance-scope ancestor still resolves --finance-income/--finance-expense/--finance-transfer for the Button variants", () => {
    expect(globals).toMatch(/\.finance-vars,\s*\n\.finance-scope,\s*\n\.finance-ui-tone\s*\{/);
  });
});

describe("Shared generic primitives are completely unchanged — Finance tone is scoped, never global", () => {
  it("Field.tsx still reads only the generic tokens — no finance-* class, no hardcoded hex, no awareness of Finance at all", () => {
    expect(field).toContain("border-border/70");
    expect(field).toContain("bg-surface");
    expect(field).toContain("text-foreground");
    expect(field).toContain("text-foreground-muted");
    expect(field).toContain("focus:border-primary");
    expect(field).toContain("focus:ring-primary-soft");
    expect(field).toContain("text-danger");
    expect(field).not.toMatch(/finance/i);
    expect(field).not.toMatch(HEX_COLOR);
  });

  it("Button.tsx's primary/secondary/ghost/danger variants are byte-for-byte the same generic classes as before — only new, additive finance* variants were introduced", () => {
    expect(button).toContain('primary: "bg-primary text-primary-foreground hover:opacity-90"');
    expect(button).toContain('secondary: "bg-primary-soft text-foreground hover:brightness-95"');
    expect(button).toContain('ghost: "bg-transparent text-foreground hover:bg-surface-muted"');
    expect(button).toContain('danger: "bg-danger text-danger-foreground hover:opacity-90"');
  });

  it("Button.tsx's new financeIncome/financeExpense/financeTransfer variants reuse the existing --finance-income/--finance-expense/--finance-transfer tokens via Tailwind utility classes — never a duplicated hex value", () => {
    expect(button).toContain('financeIncome: "bg-finance-income text-white hover:opacity-90"');
    expect(button).toContain('financeExpense: "bg-finance-expense text-white hover:opacity-90"');
    expect(button).toContain('financeTransfer: "bg-finance-transfer text-white hover:opacity-90"');
    expect(button).not.toMatch(HEX_COLOR);
  });
});

describe("Every Finance create form sheet/route applies the finance-ui-tone scope", () => {
  const forms = [
    "src/features/transactions/components/TransactionForm.tsx",
    "src/features/transactions/components/PocketTransferForm.tsx",
    "src/features/transactions/components/WalletTransferForm.tsx",
    "src/features/wallets/components/WalletForm.tsx",
    "src/features/pockets/components/AddPocketForm.tsx",
    "src/features/budgets/components/CreateBudgetForm.tsx",
    "src/features/goals/components/GoalForm.tsx",
    "src/features/installments/components/CreateInstallmentForm.tsx",
    "src/features/bills/components/BillForm.tsx",
    "src/features/recurring/components/CreateRecurringForm.tsx",
    "src/features/templates/components/CreateTemplateForm.tsx",
  ];

  for (const path of forms) {
    it(`${path} applies finance-ui-tone on its own outer element, unconditionally (not gated behind variant)`, () => {
      const source = read(path);
      expect(source, path).toContain("finance-ui-tone");
      // Never a conditional like `variant === "sheet" ? "finance-ui-tone" : ...` —
      // the class must always be present regardless of the ternary branch taken.
      const formTagMatch = source.match(/<form[^>]*className=\{?[^}]*\}?>?/);
      expect(formTagMatch, `${path} should have a <form> tag`).not.toBeNull();
    });
  }

  it("DebtCreateForm (the create form) applies finance-ui-tone; DebtPaymentForm/AdditionalDebtPrincipalForm (actions on an EXISTING debt, not Create) do not — they're out of this task's scope", () => {
    const source = read("src/features/debts/components/DebtForms.tsx");
    const createFormSrc = source.slice(source.indexOf("export function DebtCreateForm"), source.indexOf("export function DebtPaymentForm"));
    expect(createFormSrc).toContain("finance-ui-tone");
    const paymentFormSrc = source.slice(source.indexOf("export function DebtPaymentForm"), source.indexOf("export function AdditionalDebtPrincipalForm"));
    expect(paymentFormSrc).not.toContain("finance-ui-tone");
    const principalFormSrc = source.slice(source.indexOf("export function AdditionalDebtPrincipalForm"));
    expect(principalFormSrc).not.toContain("finance-ui-tone");
  });

  it("CategoryPicker and TagPicker wrap themselves in finance-ui-tone and pass tone=\"finance\" to their own BottomSheet — the picker list, quick-create form, and selected-state chips all belong to the same Finance V2 surface", () => {
    for (const path of ["src/features/categories/components/CategoryPicker.tsx", "src/features/tags/components/TagPicker.tsx"]) {
      const source = read(path);
      expect(source, path).toContain("finance-ui-tone");
      expect(source, path).toMatch(/<BottomSheet[\s\S]*?tone="finance"/);
    }
  });
});

describe("Finance form submit buttons use Finance V2 accents, income/expense/transfer semantic accents where it helps clarity", () => {
  it("TransactionForm's submit uses financeIncome for INCOME and financeExpense for EXPENSE — never the generic \"danger\" variant, which stays reserved for real destructive/error actions", () => {
    const source = read("src/features/transactions/components/TransactionForm.tsx");
    expect(source).toContain('variant={transactionType === "INCOME" ? "financeIncome" : "financeExpense"}');
    expect(source).not.toMatch(/variant=\{transactionType[^}]*"danger"/);
  });

  it("PocketTransferForm and WalletTransferForm submit with variant=\"financeTransfer\"", () => {
    for (const path of [
      "src/features/transactions/components/PocketTransferForm.tsx",
      "src/features/transactions/components/WalletTransferForm.tsx",
    ]) {
      expect(read(path), path).toContain('variant="financeTransfer"');
    }
  });

  it("every other Finance create form's submit button uses the default (unspecified) variant — resolving to finance-primary via the ambient finance-ui-tone remap, not a per-form hardcoded color", () => {
    const forms = [
      "src/features/wallets/components/WalletForm.tsx",
      "src/features/pockets/components/AddPocketForm.tsx",
      "src/features/budgets/components/CreateBudgetForm.tsx",
      "src/features/goals/components/GoalForm.tsx",
      "src/features/installments/components/CreateInstallmentForm.tsx",
      "src/features/bills/components/BillForm.tsx",
      "src/features/recurring/components/CreateRecurringForm.tsx",
      "src/features/templates/components/CreateTemplateForm.tsx",
    ];
    for (const path of forms) {
      const source = read(path);
      expect(source, path).not.toMatch(/<SubmitButton[^>]*variant=/);
    }
  });
});

describe("Non-Finance forms never receive the Finance UI tone", () => {
  it("Pet/Calendar/Household forms contain no finance-ui-tone, no finance-* class, no finance token reference at all", () => {
    const forms = [
      "src/features/pets/components/PetForm.tsx",
      "src/features/calendar/components/CalendarEventForm.tsx",
      "src/features/household/components/CreateHouseholdForm.tsx",
      "src/features/household/components/AddMemberForm.tsx",
    ];
    for (const path of forms) {
      const source = read(path);
      expect(source, path).not.toMatch(/finance/i);
    }
  });

  it("AddPetFab/AddCalendarEventFab/AddHouseholdTrigger never pass tone=\"finance\" and never reference finance-ui-tone", () => {
    const triggers = [
      "src/features/pets/components/AddPetFab.tsx",
      "src/features/calendar/components/AddCalendarEventFab.tsx",
      "src/features/household/components/AddHouseholdTrigger.tsx",
    ];
    for (const path of triggers) {
      const source = stripComments(read(path));
      expect(source, path).not.toContain('tone="finance"');
      expect(source, path).not.toContain("finance-ui-tone");
    }
  });
});

describe("Danger/error styling remains semantic — never remapped to a Finance accent", () => {
  it("every Finance form's validation error still renders via text-danger, unaffected by finance-ui-tone", () => {
    const forms = [
      "src/features/transactions/components/TransactionForm.tsx",
      "src/features/wallets/components/WalletForm.tsx",
      "src/features/pockets/components/AddPocketForm.tsx",
      "src/features/budgets/components/CreateBudgetForm.tsx",
      "src/features/goals/components/GoalForm.tsx",
      "src/features/installments/components/CreateInstallmentForm.tsx",
      "src/features/bills/components/BillForm.tsx",
      "src/features/recurring/components/CreateRecurringForm.tsx",
      "src/features/templates/components/CreateTemplateForm.tsx",
    ];
    for (const path of forms) {
      expect(read(path), path).toMatch(/text-danger/);
    }
  });

  it("ConfirmDialog (destructive confirmations) is never wrapped in finance-ui-tone and keeps its plain \"danger\" Button variant", () => {
    const source = read("src/components/ui/ConfirmDialog.tsx");
    expect(source).not.toContain("finance-ui-tone");
    expect(source).not.toMatch(/tone="finance"/);
  });
});

describe("No hardcoded duplicate Finance hex palette leaked into individual form components", () => {
  it("none of the converted form components declare a literal Finance hex color — every finance-tinted result comes from the shared finance-ui-tone/finance-vars token remap or existing bg-finance-*/text-finance-* utilities", () => {
    const forms = [
      "src/features/transactions/components/TransactionForm.tsx",
      "src/features/transactions/components/PocketTransferForm.tsx",
      "src/features/transactions/components/WalletTransferForm.tsx",
      "src/features/wallets/components/WalletForm.tsx",
      "src/features/pockets/components/AddPocketForm.tsx",
      "src/features/budgets/components/CreateBudgetForm.tsx",
      "src/features/goals/components/GoalForm.tsx",
      "src/features/installments/components/CreateInstallmentForm.tsx",
      "src/features/bills/components/BillForm.tsx",
      "src/features/recurring/components/CreateRecurringForm.tsx",
      "src/features/templates/components/CreateTemplateForm.tsx",
      "src/features/categories/components/CategoryPicker.tsx",
      "src/features/tags/components/TagPicker.tsx",
    ];
    for (const path of forms) {
      expect(read(path), path).not.toMatch(HEX_COLOR);
    }
  });
});
