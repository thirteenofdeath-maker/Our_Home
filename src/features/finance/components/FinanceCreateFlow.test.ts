import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const flow = read("src/features/finance/components/FinanceCreateFlow.tsx");

describe("FinanceCreateFlow — sheet state architecture", () => {
  it("uses one shared BottomSheet element across every stage, never a per-stage sheet instance", () => {
    expect((flow.match(/<BottomSheet/g) ?? []).length).toBe(1);
  });

  it("advancing a stage closes the sheet, waits the shared CLOSE_TRANSITION_MS, then swaps content and reopens — never an abrupt content swap with the sheet still open", () => {
    expect(flow).toMatch(/function transitionTo\(next: \(\) => void\) \{\s*setSheetOpen\(false\);\s*setTimeout\(next, CLOSE_TRANSITION_MS\);/);
  });

  it("keeps internal transition-close distinct from user dismiss so the unified transfer form reopens instead of racing closeFlow", () => {
    const sheet = read("src/components/ui/BottomSheet.tsx");
    expect(sheet).toContain("controlledClosePendingRef.current = true");
    expect(sheet).toMatch(/handleOwnDialogLifecycle\(event, onClose, false, controlledClose\)/);
    expect(flow).toMatch(/function selectTransfer\(\) \{\s*transitionTo\(async \(\) => \{[\s\S]*?setStage\("transfer"\);\s*setSheetOpen\(true\);/);
    expect(flow).toMatch(/<BottomSheet[\s\S]*?onClose=\{closeFlow\}/);
  });

  it("stage transitions never call router.push/replace — this is a same-sheet state machine, not page navigation", () => {
    expect(flow).not.toContain("router.push");
    expect(flow).not.toContain("router.replace");
    expect(flow).not.toContain("next/navigation");
  });

  it("choice sheets are content-sized, form sheets grow up to the large (~88dvh) size", () => {
    expect(flow).toMatch(/size=\{stage === "choosing" \? "content" : "large"\}/);
  });

  it("provides a subtle back affordance inside form/transfer-choice stages, never the removed page-header back arrow", () => {
    expect(flow).toContain("ย้อนกลับไปเลือกประเภท");
    expect(flow).toContain("goBack");
    // Not the global PageHeader/BackButton pattern.
    expect(flow).not.toContain("PageHeader");
  });

  it("returns the unified transfer form directly to quick-create choices", () => {
    expect(flow).toMatch(/function goBack\(\) \{[\s\S]*?setStage\("choosing"\)/);
    expect(flow).toMatch(/onClick=\{goBack\}/);
  });

  it("a load error keeps the user on the same (or previous) stage inside the sheet rather than crashing or silently closing", () => {
    expect(flow).toMatch(/catch \{\s*setLoadError\(/);
  });
});

describe("FinanceCreateFlow — reuses existing forms/writers, never forks them", () => {
  it("reuses TransactionForm and delegates the combined transfer presentation to UnifiedTransferForm", () => {
    expect(flow).toContain('import { TransactionForm } from "@/features/transactions/components/TransactionForm"');
    expect(flow).toContain('import { UnifiedTransferForm } from "@/features/transactions/components/UnifiedTransferForm"');
    for (const usage of ["<TransactionForm", "<UnifiedTransferForm"]) {
      expect(flow).toContain(usage);
    }
    expect(flow).not.toContain("transferChoice");
  });

  it("fetches sheet data through the SAME existing selectors the full-page routes use (quick-add-data.ts), never a new query/RPC", () => {
    const dataFile = read("src/features/finance/quick-add-data.ts");
    expect(dataFile).toContain("listPocketsForWallet(supabase");
    expect(dataFile).toContain("listCategoriesForWallet(supabase");
    expect(dataFile).toContain("listTags(supabase");
    expect(dataFile).toContain("listMyWallets(supabase)");
    expect(dataFile).toContain("getWallet(supabase");
    expect(dataFile).not.toMatch(/\.rpc\(|\.from\(["'][a-z_]+["']\)/);
  });

  it("existing full-page routes still render the unmodified full-page variant of every reused form — routes were not deleted", () => {
    const routes: Array<[string, string]> = [
      ["src/app/(app)/wallets/[walletId]/transactions/new/page.tsx", "<TransactionForm"],
      ["src/app/(app)/wallets/[walletId]/transfer/pocket/page.tsx", "<PocketTransferForm"],
      ["src/app/(app)/wallets/[walletId]/transfer/wallet/page.tsx", "<WalletTransferForm"],
      ["src/app/(app)/wallets/new/page.tsx", "<WalletForm"],
      ["src/app/(app)/wallets/[walletId]/pockets/new/page.tsx", "<AddPocketForm"],
    ];
    for (const [path, marker] of routes) {
      expect(read(path), path).toContain(marker);
    }
  });

  it("no writer is duplicated — createIncomeExpenseAction/createPocketTransferAction/createWalletTransferAction/createWalletAction/createPocketAction are each defined in exactly one actions.ts file", () => {
    const txActions = read("src/features/transactions/actions.ts");
    const walletActions = read("src/features/wallets/actions.ts");
    const pocketActions = read("src/features/pockets/actions.ts");
    expect((txActions.match(/export async function createIncomeExpenseAction/g) ?? []).length).toBe(1);
    expect((txActions.match(/export async function createPocketTransferAction/g) ?? []).length).toBe(1);
    expect((txActions.match(/export async function createWalletTransferAction/g) ?? []).length).toBe(1);
    expect((walletActions.match(/export async function createWalletAction/g) ?? []).length).toBe(1);
    expect((pocketActions.match(/export async function createPocketAction/g) ?? []).length).toBe(1);
    // FinanceCreateFlow/quick-add-data never redefine these — they only import the existing forms that already call them.
    expect(flow).not.toMatch(/function createIncomeExpenseAction|function createPocketTransferAction|function createWalletTransferAction/);
  });

  it("Save behavior is entirely the existing architecture: the writer's own redirect() closes the flow on success, its own {error} return leaves the form sheet open on failure — no new success/confirmation handling was added", () => {
    const txActions = read("src/features/transactions/actions.ts");
    expect(txActions).toContain("redirect(parsed.data.returnTo ?? `/wallets/${parsed.data.walletId}`)");
    expect(txActions).toMatch(/return \{ error: /);
    expect(flow).not.toContain("ConfirmDialog");
    expect(flow).not.toContain("useEffect"); // no "watch for success" polling/effect of any kind
  });

  it("no schema/domain/RPC changes were introduced by this flow", () => {
    expect(flow).not.toMatch(/\.rpc\(|\.from\(["'][a-z_]+["']\)/);
  });
});

describe("FinanceCreateFlow — Finance V2 visual language", () => {
  it("is finance-scoped and uses finance tokens for the choice rows, never the old beige/green generic palette", () => {
    expect(flow).toContain("finance-scope");
    expect(flow).toContain("bg-finance-primary");
    expect(flow).toContain("text-finance-text");
    expect(flow).toContain("text-finance-muted");
    expect(flow).toContain("bg-finance-income/15");
    expect(flow).toContain("bg-finance-expense/15");
    expect(flow).toContain("bg-finance-transfer/15");
  });

  it("passes tone=\"finance\" to its own BottomSheet — otherwise the dialog's own chrome (surface/handle/close button) would keep rendering the generic, theme-following tokens instead of the finance palette", () => {
    expect(flow).toMatch(/<BottomSheet[\s\S]*?tone="finance"/);
  });
});
