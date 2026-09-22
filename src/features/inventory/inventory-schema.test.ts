import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260922135957_household_inventory.sql",
  ),
  "utf8",
);
const atomicQuantitySql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260922152154_atomic_inventory_quantity.sql",
  ),
  "utf8",
);

describe("household inventory schema", () => {
  it("keeps observers read-only and mutations behind role-aware RPCs", () => {
    expect(sql).toContain("inventory_items_select_household");
    expect(sql).toMatch(
      /array\['owner','admin','member'\]::public\.household_role\[\]/,
    );
    expect(sql).not.toMatch(/array\[[^\]]*'observer'[^\]]*\]/);
    expect(sql).toContain(
      "revoke all privileges on table public.inventory_items",
    );
  });

  it("uses private constrained document storage", () => {
    expect(sql).toContain("'inventory-documents'");
    expect(sql).toContain("false, 6291456");
    expect(sql).toContain("inventory_assets_read");
    expect(sql).toContain("inventory_assets_insert");
  });

  it("avoids duplicate active shopping items", () => {
    expect(sql).toContain("send_inventory_item_to_shopping");
    expect(sql).toMatch(
      /shopping_item_id is not null[\s\S]*purchased_at is null/,
    );
  });

  it("adjusts quantities atomically with the same role guard", () => {
    expect(atomicQuantitySql).toContain("for update");
    expect(atomicQuantitySql).toContain(
      "set quantity = greatest(quantity + p_delta, 0)",
    );
    expect(atomicQuantitySql).toContain("if auth.uid() is null");
    expect(atomicQuantitySql).toMatch(
      /array\['owner','admin','member'\]::public\.household_role\[\]/,
    );
    expect(atomicQuantitySql).toContain(
      "revoke execute on function public.adjust_inventory_quantity(uuid,numeric) from public, anon",
    );
  });
});
