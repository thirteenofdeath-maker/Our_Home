import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const hub = read("src/app/(app)/finance/page.tsx");
const wallets = read("src/app/(app)/wallets/page.tsx");
const walletDetail = read("src/app/(app)/wallets/[walletId]/page.tsx");

describe("approved mobile Finance UI", () => {
  it("keeps a visible เพิ่มรายการ card on existing route helpers", () => {
    expect(hub).toContain("เพิ่มรายการ");
    expect(hub).toContain("บันทึกรายรับ รายจ่าย หรือโอนเงิน");
    for (const helper of ["financeIncomeHref(initialWallet.id)", "financeExpenseHref(initialWallet.id)", "financeTransferHref(initialWallet.id)"]) expect(hub).toContain(helper);
    expect(hub).not.toContain("primaryWallet");
    expect(hub).not.toMatch(/defaultWallet|mainWallet|default_wallet|main_wallet/);
  });

  it("renders currency totals independently without combining them", () => {
    expect(hub).toContain("summary.currencyTotals.map");
    expect(hub).toContain("key={total.currency}");
    expect(hub).toContain("formatCurrency(total.amount, total.currency)");
    expect(hub).not.toMatch(/reduce\s*\([\s\S]{0,100}currencyTotals/);
  });

  it("preserves Personal and Household Wallet grouping with tappable cards", () => {
    expect(wallets).toContain('w.wallet.scope === "PERSONAL"');
    expect(wallets).toContain('w.wallet.scope === "HOUSEHOLD"');
    // Finance Design V2 (Phase 1 correction): a compact two-column
    // gallery, not the old fixed-height single-line row or a full-width
    // stack — see WalletVisualCard.
    expect(wallets).toContain("<WalletVisualCard");
    expect(wallets).toContain("grid-cols-2");
    expect(wallets).toContain("PageHeader");
  });

  it("keeps the compact Pocket row within its requested height/icon budget", () => {
    const pocketManagerList = read("src/features/pockets/components/PocketManagerList.tsx");
    expect(pocketManagerList).toContain("min-h-[76px]"); // within the 72-84px target band
    expect(pocketManagerList).toContain("size-10"); // 40px icon, within the 40-44px target band
  });

  it("gives Wallet detail the shared PageHeader and keeps Pocket rename", () => {
    expect(walletDetail).toContain("<PageHeader");
    expect(walletDetail).toContain("<PocketManagerList");
    expect(walletDetail).toContain("<PocketCreateLink");
    expect(read("src/features/pockets/components/PocketManagerList.tsx")).toContain("<RenamePocketForm");
    expect(walletDetail).toContain("/manage`");
    expect(walletDetail).toContain("<PocketManagerList compact");
  });

  it("keeps wallet management controls off the wallet overview", () => {
    expect(walletDetail).not.toContain("<RenameWalletForm");
    expect(walletDetail).not.toContain("<WalletLifecycleControls");
    const management = read("src/app/(app)/wallets/[walletId]/manage/page.tsx");
    expect(management).toContain("<RenameWalletForm");
    expect(management).toContain("<WalletLifecycleControls");
    expect(management).toContain("<PocketManagerList");
  });

  it("does not add or change finance writers in the UI pass", () => {
    for (const source of [hub, wallets, walletDetail]) expect(source).not.toMatch(/\.from\(|\.rpc\(|transaction_entries/);
  });
});
