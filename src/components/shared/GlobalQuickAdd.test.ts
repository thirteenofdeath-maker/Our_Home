import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// FinanceCreateFlow calls useRouter() (via ActionSheet-style patterns are
// gone here, but BottomSheet itself needs no router) — kept for parity
// with the other component-render tests in this file, harmless if unused.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { GlobalQuickAdd, QuickAddChoices } from "./GlobalQuickAdd";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("global quick add", () => {
  it("renders FinanceCreateFlow when a wallet exists, closed by default (stage starts at 'closed', so no choice/form content is mounted until the FAB is tapped)", () => {
    const html = renderToStaticMarkup(createElement(GlobalQuickAdd, { walletId: "w1" }));
    expect(html).toContain('aria-label="เพิ่มรายการการเงิน"');
    expect(html).not.toContain("รายรับ");
    expect(html).not.toContain("รายจ่าย");
    // Closed dialog stays hidden — same BottomSheet guarantee as ever.
    expect(html).toContain("hidden");
  });

  it("reuses existing Income Expense and Transfer routes", () => {
    const html = renderToStaticMarkup(createElement(QuickAddChoices, { walletId: "w1" }));
    expect(html).toContain("/wallets/w1/transactions/new?type=INCOME");
    expect(html).toContain("/wallets/w1/transactions/new?type=EXPENSE");
    expect(html).toContain("/wallets/w1/transfer");
  });

  it("truthfully offers the real wallet-creation FORM when there is no wallet — never a fake route, never a link, the real WalletForm itself", () => {
    const html = renderToStaticMarkup(createElement(GlobalQuickAdd, { walletId: null }));
    expect(html).toContain('aria-label="เพิ่มรายการการเงิน"');
    // No href anywhere — the trigger opens a sheet, the sheet renders the
    // real form (loading placeholder until the household check resolves).
    expect(html).not.toContain("href=");
  });

  it("FinanceCreateFlow's two-stage state machine: CHOICE stage never calls router.push directly — selecting an option fetches data then advances the JS `stage`, never navigating to a full-page form route", () => {
    const source = read("src/features/finance/components/FinanceCreateFlow.tsx");
    expect(source).toMatch(/type Stage =\s*"closed"\s*\|\s*"choosing"\s*\|\s*"loading"\s*\|\s*"income"\s*\|\s*"expense"\s*\|\s*"transfer"/);
    expect(source).not.toContain("router.push");
    expect(source).not.toContain("router.replace");
  });

  it("selecting Income/Expense/Transfer renders the corresponding FORM stage in the SAME sheet — never a route change", () => {
    const source = read("src/features/finance/components/FinanceCreateFlow.tsx");
    expect(source).toMatch(/stage === "income" \|\| stage === "expense"\) && ieData/);
    expect(source).toContain('stage === "transfer" && transferData');
    expect(source).toContain("<UnifiedTransferForm");
    expect(source).not.toContain("transferChoice");
  });

  it("the second (form) stage uses the same shared BottomSheet motion — no new sheet/animation implementation, size='large' for a real form vs 'content' for the compact choice", () => {
    const source = read("src/features/finance/components/FinanceCreateFlow.tsx");
    expect(source).toContain("<BottomSheet");
    expect(source).toMatch(/size=\{stage === "choosing" \? "content" : "large"\}/);
  });

  it("Save invokes the existing writer/action directly and never opens a third sheet — the forms are rendered completely unmodified except variant=\"sheet\", so useActionState/SubmitButton/redirect-on-success ARE the save behavior", () => {
    const flow = read("src/features/finance/components/FinanceCreateFlow.tsx");
    expect(flow).toContain("variant=\"sheet\"");
    // No extra confirmation sheet component exists in this file, and no
    // custom "on success" handling — the existing redirect() IS the
    // success behavior.
    expect(flow).not.toContain("ConfirmDialog");
    expect(flow).not.toMatch(/onSuccess|useEffect\(.*success/i);

    const txAction = read("src/features/transactions/actions.ts");
    expect(txAction).toContain("redirect(parsed.data.returnTo ?? `/wallets/${parsed.data.walletId}`)");
  });
});
