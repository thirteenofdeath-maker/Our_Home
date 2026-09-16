import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CategoryNode } from "@/features/categories/types";

import { ExpenseCategorySelect } from "./ExpenseCategorySelect";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function category(id: string, name: string): CategoryNode {
  return {
    id,
    name,
    scope: "PERSONAL",
    owner_user_id: "00000000-0000-0000-0000-000000000001",
    household_id: null,
    transaction_type: "EXPENSE",
    parent_id: null,
    icon: null,
    sort_order: 0,
    is_system: false,
    system_key: null,
    archived_at: null,
    created_by: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-09-08T00:00:00Z",
    updated_at: "2026-09-08T00:00:00Z",
    children: [],
  };
}

describe("ExpenseCategorySelect", () => {
  it("uses the grouped category sheet and submits the selected UUID", () => {
    const foodId = "11111111-1111-4111-8111-111111111111";
    const travelId = "22222222-2222-4222-8222-222222222222";
    const food = category(foodId, "Food");
    const travel = { ...category(travelId, "Travel"), parent_id: foodId };
    food.children = [travel];
    const html = renderToStaticMarkup(
      createElement(ExpenseCategorySelect, {
        categories: [food],
        defaultValue: travelId,
      }),
    );

    expect(html).toContain(
      `type="hidden" name="categoryId" value="${travelId}"`,
    );
    expect(html).toContain("Food &gt; Travel");
    expect(html).toContain("ค้นหาหมวดหมู่...");
    expect(html).not.toContain('<select id="categoryId"');

    const submitted = new FormData();
    submitted.set("categoryId", travelId);
    expect(submitted.get("categoryId")).toBe(travelId);
  });
});
