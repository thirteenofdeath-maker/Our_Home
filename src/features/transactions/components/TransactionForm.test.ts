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
    expect(source).toContain('<input type="hidden" name="walletId" value={activeWalletId} />');
  });

  it("disables the wallet select while a switch is in flight, preventing a duplicate change mid-fetch", () => {
    expect(source).toContain("disabled={walletSwitchPending}");
  });
});
