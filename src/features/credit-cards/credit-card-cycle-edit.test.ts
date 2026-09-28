import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("credit-card cycle editing", () => {
  it("shows editable closing and due days only in credit-card management", () => {
    const page = read("src/app/(app)/wallets/[walletId]/manage/page.tsx");
    const form = read(
      "src/features/credit-cards/components/CreditCardCycleForm.tsx",
    );
    expect(page).toContain('wallet.wallet_type === "CREDIT_CARD"');
    expect(page).toContain("<CreditCardCycleForm");
    expect(form).toContain('name="statementClosingDay"');
    expect(form).toContain('name="paymentDueDay"');
    expect(form).toContain("min={1}");
    expect(form).toContain("max={31}");
  });

  it("reloads the authorized account server-side before preserving other card fields", () => {
    const actions = read("src/features/credit-cards/actions.ts");
    expect(actions).toContain("await listCreditCardAccounts(supabase");
    expect(actions).toContain("updateCreditCardAccount(supabase");
    expect(actions).toContain(
      "statementClosingDay: parsed.data.statementClosingDay",
    );
    expect(actions).toContain("paymentDueDay: parsed.data.paymentDueDay");
  });
});
