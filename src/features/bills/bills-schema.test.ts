import { readFileSync } from "node:fs";import { resolve } from "node:path";import { describe,expect,it } from "vitest";
const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/0037_bills.sql"),"utf8");
describe("Bills SQL contract",()=>{
  it("stores stable lifecycle and unique amount snapshots",()=>{expect(sql).toMatch(/status in \('OPEN','PAID','SKIPPED'\)/);expect(sql).toMatch(/expected_amount numeric/);expect(sql).toMatch(/unique\(bill_id,due_date\)/)});
  it("reuses recurrence math and locks atomic payment",()=>{expect(sql).toContain("public.recurring_next_due_date");expect(sql).toMatch(/pay_bill_occurrence[\s\S]*for update/);expect(sql).toContain("public.create_income_expense_transaction('EXPENSE'")});
  it("enforces currency and locked occurrence writes",()=>{expect(sql).toContain("v_wallet.currency<>v_bill.currency");expect(sql).toMatch(/grant select on public.bill_occurrences to authenticated/)});
});
