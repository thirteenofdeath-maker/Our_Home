import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/features/transactions/components/UnifiedTransferForm.tsx"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/features/transactions/actions.ts"), "utf8");
const data = readFileSync(resolve(process.cwd(), "src/features/finance/quick-add-data.ts"), "utf8");

describe("UnifiedTransferForm", () => {
  it("keeps one parent form mounted while FROM and TO use a child BottomSheet", () => {
    expect(source).toContain('<BottomSheet open={picker !== null}');
    expect(source).toContain('setPicker("from")');
    expect(source).toContain('setPicker("to")');
    expect(source).toContain("onClose={() => setPicker(null)}");
  });

  it("keeps amount as a decimal string and delegates validation to the existing decimal schema", () => {
    expect(source).toContain('const [amount, setAmount] = useState("")');
    expect(source).toContain('inputMode="decimal"');
    expect(actions).toMatch(/unifiedTransferSchema[\s\S]*?amount: positiveAmountSchema/);
  });

  it("starts without an arbitrary destination and disables submit until destination and amount are valid", () => {
    expect(source).toContain("useState<TransferEndpoint | null>(null)");
    expect(source).toContain('เลือกปลายทาง');
    expect(source).toMatch(/disabled=\{!to \|\| !isValidTransferDestination\(from, to\) \|\| !isValidTransferAmount\(amount\)\}/);
    expect(source).not.toContain("firstValidDestination");
  });

  it("clears only an invalid destination on source change while the mounted amount and note fields survive", () => {
    expect(source).toContain("setTo((current) => reconcileTransferDestination(endpoint, current, endpoints))");
    expect(source).toContain('value={amount}');
    expect(source).toContain('name="note"');
  });

  it("dispatches to the existing pocket or wallet writer without another sheet", () => {
    expect(actions).toMatch(/fromWalletId === parsed\.data\.toWalletId[\s\S]*?createPocketTransfer[\s\S]*?createWalletTransfer/);
    expect(source).not.toContain("ConfirmDialog");
  });

  it("loads only active wallets and pockets and includes ledger-derived balances", () => {
    expect(data).toContain("listMyWallets(supabase)");
    expect(data).toContain("listPocketsWithBalances(supabase, candidate.id)");
  });
});
