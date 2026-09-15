import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const hub = read("src/app/(app)/finance/page.tsx");
const wallets = read("src/app/(app)/wallets/page.tsx");
const walletDetail = read("src/app/(app)/wallets/[walletId]/page.tsx");
const addWorkspace = read(
  "src/features/finance/components/FinanceAddWorkspace.tsx",
);
const createFlow = read(
  "src/features/finance/components/FinanceCreateFlow.tsx",
);

describe("approved mobile Finance UI", () => {
  it("uses the shared floating add entry point instead of a dashboard banner", () => {
    expect(createFlow).toContain("เพิ่มรายการ");
    expect(hub).toContain("<FinanceCreateFlow");
    expect(hub).not.toContain("triggerVariant");
    expect(createFlow).not.toContain("triggerVariant");
    expect(createFlow).toContain("fixed z-20 flex size-14");
    expect(createFlow).not.toContain("min-h-16 w-full");
    expect(createFlow).toContain("<BottomSheet");
    expect(hub).not.toContain(
      "/finance/quick-add?walletId=${initialWallet.id}",
    );
    for (const helper of [
      "financeIncomeHref(initialWallet.id)",
      "financeExpenseHref(initialWallet.id)",
      "financeTransferHref(initialWallet.id)",
    ])
      expect(hub).not.toContain(helper);
    expect(hub).not.toContain("primaryWallet");
    expect(hub).not.toMatch(
      /defaultWallet|mainWallet|default_wallet|main_wallet/,
    );
    expect(hub.indexOf("balanceCards.map")).toBeLessThan(
      hub.indexOf("{initialWallet ? ("),
    );
  });

  it("shows all five add-entry types in one compact, non-scrolling mobile grid", () => {
    for (const label of [
      "รายจ่าย",
      "รายรับ",
      "โอนเงิน",
      "บัตรเครดิต",
      "ผ่อนชำระ",
    ]) {
      expect(addWorkspace).toContain(`label: "${label}"`);
    }
    expect(addWorkspace).toContain("grid-cols-6");
    expect(addWorkspace).toContain('index < 3 ? "col-span-2" : "col-span-3"');
    expect(addWorkspace).not.toContain("overflow-x-auto");
    expect(addWorkspace).not.toContain("min-w-max");
  });

  it("renders currency totals independently without combining them", () => {
    expect(hub).toContain("balanceCards.map");
    expect(hub).toContain("key={balance.currency}");
    expect(hub).toContain("formatCurrency(balance.amount, balance.currency)");
    expect(hub).not.toContain("summary.currencyTotals.slice(1)");
    expect(hub).not.toMatch(/reduce\s*\([\s\S]{0,100}currencyTotals/);
  });

  it("switches the whole dashboard between personal and household data", () => {
    expect(hub).toContain('ariaLabel="ขอบเขตข้อมูลการเงิน"');
    expect(hub).toContain('rawScope === "HOUSEHOLD"');
    expect(hub).toContain("wallet.scope === scope");
    expect(hub).toContain("listRecentFinanceTransactions(supabase, {");
    expect(hub).toContain("listGoals(supabase, scope, householdId)");
    expect(hub).toContain("listDebts(supabase, scope, householdId)");
    expect(hub).toContain("listBills(supabase, { scope, householdId })");
  });

  it("preserves Personal and Household Wallet grouping with tappable cards", () => {
    expect(wallets).toContain("item.wallet.scope === scope");
    expect(wallets).toContain('rawScope === "HOUSEHOLD"');
    // Finance Design V2 (Phase 1 correction): a compact two-column
    // gallery, not the old fixed-height single-line row or a full-width
    // stack — see WalletVisualCard.
    expect(wallets).toContain("<WalletVisualCard");
    expect(wallets).toContain("grid-cols-2");
    expect(wallets).toContain("PageHeader");
    expect(wallets).not.toContain("FinanceModuleTabs");
  });

  it("places the selected month directly with the trend summary instead of at the page top", () => {
    const monthSwitcher = hub.indexOf('aria-label="เดือนก่อนหน้า"');
    const trendHeading = hub.indexOf('title="สรุปรายรับรายจ่าย"');
    const addEntry = hub.indexOf("{initialWallet ? (");

    expect(monthSwitcher).toBeGreaterThan(trendHeading);
    expect(monthSwitcher).toBeGreaterThan(addEntry);
    expect(monthSwitcher).toBeLessThan(hub.indexOf("<FinanceTrendCard"));
  });

  it("keeps the compact Pocket row within its requested height/icon budget", () => {
    const pocketManagerList = read(
      "src/features/pockets/components/PocketManagerList.tsx",
    );
    expect(pocketManagerList).toContain("min-h-[76px]"); // within the 72-84px target band
    expect(pocketManagerList).toContain("size-10"); // 40px icon, within the 40-44px target band
  });

  it("gives Wallet detail the shared PageHeader and keeps Pocket rename", () => {
    expect(walletDetail).toContain("<PageHeader");
    expect(walletDetail).toContain("<PocketManagerList");
    expect(walletDetail).toContain("<PocketCreateLink");
    expect(
      read("src/features/pockets/components/PocketManagerList.tsx"),
    ).toContain("<RenamePocketForm");
    expect(walletDetail).toContain("/manage`");
    expect(walletDetail).toMatch(/<PocketManagerList\s+compact/);
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
    for (const source of [hub, wallets, walletDetail])
      expect(source).not.toMatch(/\.from\(|\.rpc\(|transaction_entries/);
  });
});
