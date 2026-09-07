import { describe, expect, it } from "vitest";

import type { Category } from "../types";
import { buildCategoryTree } from "./tree";

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "id",
    scope: "PERSONAL",
    owner_user_id: "u1",
    household_id: null,
    name: "name",
    transaction_type: "EXPENSE",
    parent_id: null,
    icon: null,
    sort_order: 0,
    is_system: false,
    archived_at: null,
    created_by: "u1",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

describe("buildCategoryTree", () => {
  it("nests subcategories under their parent, two levels only", () => {
    const food = makeCategory({ id: "food", name: "Food", sort_order: 0 });
    const coffee = makeCategory({ id: "coffee", name: "Coffee", parent_id: "food", sort_order: 1 });
    const restaurant = makeCategory({ id: "restaurant", name: "Restaurant", parent_id: "food", sort_order: 0 });
    const pets = makeCategory({ id: "pets", name: "Pets", sort_order: 1 });

    const tree = buildCategoryTree([food, coffee, restaurant, pets]);

    expect(tree.map((n) => n.name)).toEqual(["Food", "Pets"]);
    expect(tree[0].children.map((n) => n.name)).toEqual(["Restaurant", "Coffee"]);
    expect(tree[1].children).toEqual([]);
  });
});
