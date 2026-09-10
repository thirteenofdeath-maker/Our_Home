import{readFileSync}from"node:fs";import{resolve}from"node:path";import{describe,expect,it}from"vitest";
const enumSql=readFileSync(resolve(process.cwd(),"supabase/migrations/0040_debt_principal_transaction_type.sql"),"utf8");
const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/0041_debt_borrow_lend.sql"),"utf8");
describe("cash-linked debts",()=>{
 it("uses explicit principal semantic",()=>{expect(enumSql).toContain("DEBT_PRINCIPAL");expect(sql).toContain("'DEBT_PRINCIPAL'")});
 it("derives outstanding excluding voided events",()=>{expect(sql).toMatch(/debt_outstanding[\s\S]*t.deleted_at is null/)});
 it("locks compound payments and rejects overpay",()=>{expect(sql).toMatch(/record_debt_payment[\s\S]*for update/);expect(sql).toContain("p_principal>outstanding")});
 it("records additional principal without Income or Expense",()=>{const body=sql.match(/create function public\.record_additional_debt_principal[\s\S]*?grant execute[^;]+;/)?.[0]??"";expect(body).toContain("for update");expect(body).toContain("create_debt_principal_transaction");expect(body).not.toContain("create_income_expense_transaction")});
 it("blocks financial events on archived contracts",()=>{expect(sql.match(/Debt is archived/g)).toHaveLength(2)});
 it("syncs compound void state",()=>{expect(sql).toContain("sync_debt_event_void_state")});
});
