import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CategoryNode } from "@/features/categories/types";

import { ExpenseCategorySelect } from "./ExpenseCategorySelect";

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
  it("renders two selectable UUID options and submits the selected UUID", () => {
    const foodId = "11111111-1111-4111-8111-111111111111";
    const travelId = "22222222-2222-4222-8222-222222222222";
    const food = category(foodId, "Food");
    const travel = { ...category(travelId, "Travel"), parent_id: foodId };
    food.children = [travel];
    const html = renderToStaticMarkup(
      createElement(ExpenseCategorySelect, {
        categories: [food],
      }),
    );

    expect(html).toContain('select id="categoryId" name="categoryId" required=""');
    expect(html).toContain(`<option value="${foodId}">Food</option>`);
    expect(html).toContain(`<option value="${travelId}">Food &gt; Travel</option>`);
    expect(html).not.toContain(`<option value="${foodId}" disabled="">`);
    expect(html).not.toContain(`<option value="${travelId}" disabled="">`);

    const submitted = new FormData();
    submitted.set("categoryId", travelId);
    expect(submitted.get("categoryId")).toBe(travelId);
  });
});
