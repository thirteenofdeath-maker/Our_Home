import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CategoryNode } from "../types";
import { CategoryPicker, filterCategories } from "./CategoryPicker";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function node(id: string, name: string, children: CategoryNode[] = [], isSystem = true): CategoryNode {
  return { id, name, children, is_system: isSystem, system_key: isSystem ? id : null, scope: isSystem ? null : "PERSONAL", owner_user_id: null, household_id: null, transaction_type: "EXPENSE", parent_id: null, icon: null, sort_order: 0, archived_at: null, created_by: null, created_at: "", updated_at: "" };
}

describe("CategoryPicker", () => {
  const meal = node("child-meal", "อาหารมื้อหลัก");
  const food = node("root-food", "อาหารและเครื่องดื่ม", [meal]);
  const home = node("root-home", "บ้านและที่อยู่อาศัย", [node("child-rent", "ค่าเช่า")]);

  it("submits the exact selected UUID and renders grouped hierarchy", () => {
    const html = renderToStaticMarkup(createElement(CategoryPicker, { name: "categoryId", categories: [food, home], transactionType: "EXPENSE", walletId: "wallet-1", defaultSelected: { id: meal.id, label: "" } }));
    expect(html).toContain('type="hidden" name="categoryId" value="child-meal"');
    expect(html).toContain("อาหารและเครื่องดื่ม &gt; อาหารมื้อหลัก");
    expect(html).toContain("ค้นหาหมวดหมู่...");
    expect(html).toContain("บ้านและที่อยู่อาศัย");
  });

  it("searches Thai child names while retaining their root group", () => {
    const filtered = filterCategories([food, home], "เช่า");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe("บ้านและที่อยู่อาศัย");
    expect(filtered[0]?.children.map((item) => item.id)).toEqual(["child-rent"]);
  });
});
