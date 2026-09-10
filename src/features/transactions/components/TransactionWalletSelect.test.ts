import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { TransactionWalletSelect, transactionWalletHref } from "./TransactionWalletSelect";

const wallets = [
  { id: "personal-wallet", name: "KBank", currency: "THB", scope: "PERSONAL" as const },
  { id: "household-wallet", name: "เงินสดบ้าน", currency: "THB", scope: "HOUSEHOLD" as const },
];

describe("TransactionWalletSelect", () => {
  it.each(["INCOME", "EXPENSE"] as const)("shows a visible Wallet selector for %s", (transactionType) => {
    const html = renderToStaticMarkup(createElement(TransactionWalletSelect, {
      wallets, currentWalletId: "household-wallet", transactionType,
    }));
    expect(html).toContain("กระเป๋าเงิน (Wallet)");
    expect(html).toContain("KBank · THB · ส่วนตัว");
    expect(html).toContain("เงินสดบ้าน · THB · ครอบครัว");
    expect(html).toContain('<option value="household-wallet" selected="">');
  });

  it("switches route while preserving validated context", () => {
    expect(transactionWalletHref("new-wallet", {
      transactionType: "EXPENSE", returnTo: "/finance", templateId: "template-id", occurrenceId: "occurrence-id",
    })).toBe("/wallets/new-wallet/transactions/new?type=EXPENSE&returnTo=%2Ffinance&templateId=template-id&occurrenceId=occurrence-id");
  });

  it("reloads wallet-dependent data and lists only active RLS-visible wallets", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/(app)/wallets/[walletId]/transactions/new/page.tsx"), "utf8");
    const walletApi = readFileSync(resolve(process.cwd(), "src/features/wallets/api.ts"), "utf8");
    expect(page).toContain("listMyWallets(supabase)");
    expect(walletApi).toMatch(/listMyWallets[\s\S]*\.eq\("is_archived", false\)/);
    expect(page).toContain("listPocketsForWallet(supabase, walletId)");
    expect(page).toContain("listCategoriesForWallet(supabase, { transactionType, wallet })");
    expect(page).toContain("listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id })");
  });
});
