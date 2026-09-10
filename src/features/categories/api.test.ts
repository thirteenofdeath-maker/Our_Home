import { describe, expect, it } from "vitest";

import { listCategoriesForWallet } from "./api";
import type { Category } from "./types";

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "id",
    scope: "PERSONAL",
    owner_user_id: "user-a",
    household_id: null,
    name: "name",
    transaction_type: "EXPENSE",
    parent_id: null,
    icon: null,
    sort_order: 0,
    is_system: false,
    archived_at: null,
    created_by: "user-a",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Minimal stand-in for the slice of the supabase-js query builder
 * listCategoriesForWallet actually uses: chained `.eq()`/`.is()`, a final
 * `.order()`, and PromiseLike resolution to `{ data, error }`. It filters
 * the fixture rows the same way Postgres would for a plain AND of
 * equality/is-null conditions.
 *
 * Deliberately has NO `.or()` method. If listCategoriesForWallet ever
 * regresses to a hand-built PostgREST `or(...,and(...))` filter string
 * (the actual bug this file guards against — see the comment on
 * listCategoriesForWallet in api.ts), these tests fail with a clear
 * "fakeBuilder.or is not a function" instead of silently passing.
 */
function fakeSupabase(rows: Category[]) {
  type Filter = (row: Category) => boolean;

  function makeBuilder(filters: Filter[]) {
    return {
      eq(column: keyof Category, value: unknown) {
        return makeBuilder([...filters, (row) => row[column] === value]);
      },
      is(column: keyof Category, value: null) {
        return makeBuilder([...filters, (row) => row[column] === value]);
      },
      order() {
        return this;
      },
      then(resolve: (result: { data: Category[]; error: null }) => void) {
        resolve({ data: rows.filter((row) => filters.every((f) => f(row))), error: null });
      },
    };
  }

  return {
    from() {
      return { select: () => makeBuilder([]) };
    },
    // Not used by listCategoriesForWallet, present only so this object is
    // shaped closely enough to satisfy call sites that don't reach it.
  };
}

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const HOUSEHOLD_ID = "33333333-3333-3333-3333-333333333333";

const fixtures: Category[] = [
  makeCategory({ id: "expense-own", transaction_type: "EXPENSE", owner_user_id: OWNER_A }),
  makeCategory({
    id: "expense-archived",
    transaction_type: "EXPENSE",
    owner_user_id: OWNER_A,
    archived_at: "2026-02-01T00:00:00Z",
  }),
  makeCategory({ id: "expense-other-owner", transaction_type: "EXPENSE", owner_user_id: OWNER_B }),
  makeCategory({ id: "income-own", transaction_type: "INCOME", owner_user_id: OWNER_A }),
  makeCategory({ id: "income-sub", transaction_type: "INCOME", owner_user_id: OWNER_A, parent_id: "income-own" }),
  makeCategory({ id: "income-other-owner", transaction_type: "INCOME", owner_user_id: OWNER_B }),
  makeCategory({
    id: "household-expense",
    scope: "HOUSEHOLD",
    owner_user_id: null,
    household_id: HOUSEHOLD_ID,
    transaction_type: "EXPENSE",
  }),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the Supabase query builder, see fakeSupabase's own comment
const supabase = () => fakeSupabase(fixtures) as any;

describe("listCategoriesForWallet: personal wallet", () => {
  it("lists only active EXPENSE categories owned by the wallet's owner", async () => {
    const result = await listCategoriesForWallet(supabase(), {
      transactionType: "EXPENSE",
      wallet: { scope: "PERSONAL", owner_user_id: OWNER_A, household_id: null },
    });

    // Excludes: another owner's expense category, and the archived one —
    // proves requirements 1 (EXPENSE only), 3 (this wallet's owner only),
    // and 5 (archived excluded) together.
    expect(result.map((c) => c.id)).toEqual(["expense-own"]);
  });

  it("lists only active INCOME categories owned by the wallet's owner, including subcategories", async () => {
    const result = await listCategoriesForWallet(supabase(), {
      transactionType: "INCOME",
      wallet: { scope: "PERSONAL", owner_user_id: OWNER_A, household_id: null },
    });

    // Both the root category and its subcategory come back — proves
    // requirement 6 (root and subcategories both selectable): the query
    // filters by owner/type only, never by parent_id, so a subcategory is
    // never accidentally excluded.
    expect(result.map((c) => c.id).sort()).toEqual(["income-own", "income-sub"]);
  });
});

describe("listCategoriesForWallet: household wallet", () => {
  it("lists categories belonging to that exact household, never by owner_user_id", async () => {
    const result = await listCategoriesForWallet(supabase(), {
      transactionType: "EXPENSE",
      wallet: { scope: "HOUSEHOLD", owner_user_id: null, household_id: HOUSEHOLD_ID },
    });

    expect(result.map((c) => c.id)).toEqual(["household-expense"]);
  });
});
