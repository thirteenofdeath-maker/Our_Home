import { describe, expect, it } from "vitest";

import { groupInventoryByCategory, type InventoryItem } from "./types";

function item(id: string, category: InventoryItem["category"]): InventoryItem {
  return {
    id,
    household_id: "11111111-1111-4111-8111-111111111111",
    name: id,
    category,
    note: null,
    quantity: "1",
    unit: null,
    restock_threshold: null,
    expiry_date: null,
    warranty_expires_on: null,
    purchase_date: null,
    location: null,
    estimated_restock_amount: null,
    currency: "THB",
    shopping_item_id: null,
    archived_at: null,
    created_by: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-10-04T00:00:00Z",
    updated_at: "2026-10-04T00:00:00Z",
  };
}

describe("groupInventoryByCategory", () => {
  it("groups items in the household-friendly category order and omits empty groups", () => {
    const groups = groupInventoryByCategory([
      item("food", "FOOD"),
      item("pet-1", "PET_SUPPLY"),
      item("other", "OTHER"),
      item("pet-2", "PET_SUPPLY"),
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      "PET_SUPPLY",
      "FOOD",
      "OTHER",
    ]);
    expect(groups[0].items.map((entry) => entry.id)).toEqual([
      "pet-1",
      "pet-2",
    ]);
  });
});
