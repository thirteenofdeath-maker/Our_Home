import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";
const migration=readFileSync(resolve(process.cwd(),"supabase/migrations/0062_credit_card_balance_adjustment.sql"),"utf8");
const form=readFileSync(resolve(process.cwd(),"src/features/credit-cards/components/CreditCardBalanceAdjustmentForm.tsx"),"utf8");
const detail=readFileSync(resolve(process.cwd(),"src/app/(app)/finance/transactions/[transactionId]/page.tsx"),"utf8");
describe("credit-card balance adjustment",()=>{
  it("posts exact ledger delta with opposite liability effect",()=>{
    expect(migration).toContain("v_delta := p_target_wallet_balance-v_current");
    expect(migration).toContain("values(v_transaction_id,v_card.wallet_id,v_card.system_pocket_id,v_delta)");
    expect(migration).toContain("'BALANCE_ADJUSTMENT',-v_delta");
    expect(migration).toContain("'CARD_ADJUSTMENT'");
  });
  it("is server-authorized, locked, archive-safe and not income/expense",()=>{
    expect(migration).toContain("for update"); expect(migration).toContain("public.is_wallet_authorized");
    expect(migration).toContain("Credit card is archived"); expect(migration).not.toContain("create_income_expense_transaction");
  });
  it("supports liability, card credit, and zero issuer states",()=>{
    expect(form).toContain('value="LIABILITY"'); expect(form).toContain('value="CREDIT"'); expect(form).toContain('value="ZERO"');
    expect(form).toContain("ไม่ใช่รายรับหรือรายจ่าย");
    expect(detail).toContain("ยอดบัตรจะกลับเป็นค่าก่อนการปรับยอด"); expect(detail).toContain("กู้คืนการปรับยอด");
  });
});
