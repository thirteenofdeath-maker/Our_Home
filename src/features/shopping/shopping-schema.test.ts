import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260922124001_shared_shopping_list.sql",
  ),
  "utf8",
);
const indexMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260922124652_shopping_foreign_key_indexes.sql",
  ),
  "utf8",
);
const householdExpenseMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261004232000_household_shopping_expenses_and_chore_delete.sql",
  ),
  "utf8",
);
const actions = readFileSync(
  resolve(process.cwd(), "src/features/shopping/actions.ts"),
  "utf8",
);
const page = readFileSync(
  resolve(process.cwd(), "src/app/(app)/calendar/page.tsx"),
  "utf8",
);

describe("shared shopping list contract", () => {
  it("allows household reads while keeping every table mutation behind RPCs", () => {
    expect(migration).toContain(
      "alter table public.shopping_items enable row level security",
    );
    expect(migration).toContain(
      "using (public.is_household_member(household_id))",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.shopping_items from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select on table public.shopping_items to authenticated",
    );
  });

  it("excludes observers from writes and assignee choices", () => {
    expect(migration).toContain(
      "array['owner','admin','member']::public.household_role[]",
    );
    expect(migration).toContain("hm.role <> 'observer'");
    expect(page).toContain('household.myRole !== "observer"');
  });

  it("creates the expense and marks the item purchased atomically", () => {
    expect(householdExpenseMigration).toMatch(
      /create or replace function public\.create_shopping_item_expense[\s\S]*update public\.shopping_items[\s\S]*expense_transaction_id = v_transaction_id/,
    );
    expect(actions).toContain('supabase.rpc("create_shopping_item_expense"');
    expect(migration).toContain("expense_transaction_id uuid unique");
  });

  it("always classifies shopping purchases as household expenses", () => {
    expect(householdExpenseMigration).toContain(
      "v_wallet.household_id is distinct from v_item.household_id",
    );
    expect(householdExpenseMigration).toContain(
      "public.create_attributed_household_expense(",
    );
    expect(householdExpenseMigration).toContain(
      "public.create_attributed_card_purchase(",
    );
    expect(householdExpenseMigration).toContain(
      "public.create_card_purchase(",
    );
  });

  it("supports responsibility, store, quantity and budget metadata", () => {
    for (const field of [
      "assigned_member_id",
      "store",
      "quantity",
      "estimated_amount",
      "currency",
    ]) {
      expect(migration).toContain(field);
    }
  });

  it("indexes every shopping foreign key used by relational checks", () => {
    expect(indexMigration).toContain(
      "shopping_items_assignee_household_fk_idx",
    );
    expect(indexMigration).toContain("shopping_items_created_by_idx");
    expect(indexMigration).toContain("shopping_items_purchased_by_idx");
  });
});
