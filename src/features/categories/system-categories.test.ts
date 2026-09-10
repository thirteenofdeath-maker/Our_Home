import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryManagerList } from "./components/CategoryManagerList";
import type { CategoryNode } from "./types";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0050_default_system_categories.sql"), "utf8");

function category(overrides: Partial<CategoryNode>): CategoryNode {
  return { id: "category-id", scope: null, owner_user_id: null, household_id: null,
    name: "อาหารและเครื่องดื่ม", transaction_type: "EXPENSE", parent_id: null, icon: null,
    sort_order: 1000, is_system: true, system_key: "expense.food", archived_at: null,
    created_by: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    children: [], ...overrides };
}

describe("0050 default system category pack", () => {
  it("is the sole migration after the live 0049 head", () => {
    const later = readdirSync(resolve(process.cwd(), "supabase/migrations")).filter((name) => /^005\d_/.test(name));
    expect(later).toEqual(["0050_default_system_categories.sql"]);
  });

  it("models system identity without fake ownership and protects user identity", () => {
    expect(sql).toMatch(/is_system[\s\S]*scope is null[\s\S]*created_by is null/);
    expect(sql).toMatch(/not is_system[\s\S]*system_key is null[\s\S]*created_by is not null/);
    expect(sql).toContain("categories_system_key_unique unique (system_key)");
  });

  it("requires non-system scope explicitly so PostgreSQL CHECK cannot pass on NULL", () => {
    expect(sql).toMatch(
      /not is_system\s+and system_key is null\s+and created_by is not null\s+and scope is not null\s+and \(/,
    );
  });

  it("contains all stable roots and representative children", () => {
    const expenseRoots = [...sql.matchAll(/\('expense\.[a-z_]+','[^']+','EXPENSE'::public\.category_transaction_type,\d+\)/g)];
    const incomeRoots = [...sql.matchAll(/\('income\.[a-z_]+','[^']+','INCOME'::public\.category_transaction_type,\d+\)/g)];
    expect(expenseRoots).toHaveLength(20);
    expect(incomeRoots).toHaveLength(13);
    const expenseChildren = [...sql.matchAll(/\('expense\.[a-z_]+\.[a-z_]+','expense\./g)];
    expect(expenseChildren).toHaveLength(118);
    for (const value of ["expense.food.meals", "expense.pets.vet", "expense.finance_fees.loan_interest", "income.salary.regular", "income.benefits.tax_refund"]) expect(sql).toContain(`'${value}'`);
  });

  it("does not seed accounting-forbidden categories", () => {
    for (const forbidden of ["เงินคืนสินค้า", "Reimbursement", "Refund", "เงินกู้", "ยืมเงิน", "เงินต้นหนี้", "โอนเงิน", "เติม Wallet", "ค่าผ่อนบ้าน", "ค่าผ่อนรถ", "expense.home.mortgage", "expense.transport.car_payment"]) expect(sql).not.toContain(`'${forbidden}'`);
  });

  it("keeps system controls read-only while custom controls remain", () => {
    const systemHtml = renderToStaticMarkup(createElement(CategoryManagerList, { tree: [category({})] }));
    expect(systemHtml).toContain("ค่าเริ่มต้น");
    expect(systemHtml).not.toContain("เปลี่ยนชื่อ");
    expect(systemHtml).not.toContain("เก็บถาวร");
    const customHtml = renderToStaticMarkup(createElement(CategoryManagerList, { tree: [category({ is_system: false, system_key: null, scope: "PERSONAL", created_by: "user-a" })] }));
    expect(customHtml).toContain("แก้ไขชื่อ");
    expect(customHtml).toContain("เก็บถาวร");
  });
});
