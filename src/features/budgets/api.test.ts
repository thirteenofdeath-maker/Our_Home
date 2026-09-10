import { describe, expect, it } from "vitest";

import { archiveBudget, createBudget, getBudget, getBudgetSummary, restoreBudget, updateBudgetAmount } from "./api";

function fakeSupabaseTable(onCall: (method: string, args: unknown[]) => void, resolved: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    onCall(method, args);
    return builder;
  };
  builder.insert = chain("insert");
  builder.update = chain("update");
  builder.select = chain("select");
  builder.eq = chain("eq");
  builder.single = async () => resolved;
  builder.maybeSingle = async () => resolved;
  builder.then = (resolve: (v: { data: unknown; error: unknown }) => void) => resolve(resolved);
  return builder;
}

describe("createBudget", () => {
  it("sends scope/owner/household/category/currency/period/amount/created_by", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: { id: "b1" }, error: null }) };

    await createBudget(supabase as never, {
      scope: "PERSONAL",
      ownerUserId: "user-a",
      householdId: null,
      categoryId: "cat-1",
      currency: "THB",
      periodMonth: "2026-09-01",
      amount: "5000.00",
      createdBy: "user-a",
    });

    expect(calls).toContainEqual({
      m: "insert",
      a: [
        {
          scope: "PERSONAL",
          owner_user_id: "user-a",
          household_id: null,
          category_id: "cat-1",
          currency: "THB",
          period_month: "2026-09-01",
          amount: "5000.00",
          created_by: "user-a",
        },
      ],
    });
  });

  it("throws (does not swallow) a duplicate/category rejection", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "duplicate key", code: "23505" } }) };
    await expect(
      createBudget(supabase as never, {
        scope: "PERSONAL",
        ownerUserId: "user-a",
        householdId: null,
        categoryId: "cat-1",
        currency: "THB",
        periodMonth: "2026-09-01",
        amount: "5000.00",
        createdBy: "user-a",
      }),
    ).rejects.toBeTruthy();
  });
});

describe("updateBudgetAmount / archiveBudget / restoreBudget", () => {
  it("update sends only amount", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: null, error: null }) };
    await updateBudgetAmount(supabase as never, "b1", "6000.00");
    expect(calls).toContainEqual({ m: "update", a: [{ amount: "6000.00" }] });
  });

  it("archive sets archived_at, restore clears it", async () => {
    const archiveCalls: unknown[] = [];
    const archiveSupabase = { from: () => fakeSupabaseTable((m, a) => archiveCalls.push({ m, a }), { data: null, error: null }) };
    await archiveBudget(archiveSupabase as never, "b1");
    expect((archiveCalls[0] as { a: [{ archived_at: string }] }).a[0].archived_at).toBeTypeOf("string");

    const restoreCalls: unknown[] = [];
    const restoreSupabase = { from: () => fakeSupabaseTable((m, a) => restoreCalls.push({ m, a }), { data: null, error: null }) };
    await restoreBudget(restoreSupabase as never, "b1");
    expect(restoreCalls).toContainEqual({ m: "update", a: [{ archived_at: null }] });
  });

  it("restore surfaces a conflict-with-an-active-budget rejection rather than swallowing it", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "duplicate key", code: "23505" } }) };
    await expect(restoreBudget(supabase as never, "b1")).rejects.toBeTruthy();
  });
});

describe("getBudget", () => {
  it("returns null (not throw) when not found or inaccessible", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: null }) };
    expect(await getBudget(supabase as never, "b1")).toBeNull();
  });
});

describe("getBudgetSummary", () => {
  it("calls get_budget_summary and splits active vs archived", async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const wireItems = [
      {
        budget_id: "b1",
        category_id: "cat-1",
        category_name: "อาหาร",
        category_archived: false,
        currency: "THB",
        period_month: "2026-09-01",
        budget_amount: "5000.00",
        net_spent: "3200.00",
        remaining: "1800.00",
        archived_at: null,
      },
      {
        budget_id: "b2",
        category_id: "cat-2",
        category_name: "เดินทาง",
        category_archived: false,
        currency: "THB",
        period_month: "2026-09-01",
        budget_amount: "2000.00",
        net_spent: "1850.00",
        remaining: "150.00",
        archived_at: "2026-09-05T00:00:00.000Z",
      },
    ];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: wireItems, error: null };
      },
    };

    const result = await getBudgetSummary(supabase as never, { periodMonth: "2026-09-01", monthStart: "2026-09-01T00:00:00+07:00", monthEnd: "2026-10-01T00:00:00+07:00" });

    expect(calls).toEqual([
      {
        fn: "get_budget_summary",
        args: { p_period_month: "2026-09-01", p_month_start: "2026-09-01T00:00:00+07:00", p_month_end: "2026-10-01T00:00:00+07:00" },
      },
    ]);
    expect(result.active).toEqual([
      {
        budgetId: "b1",
        categoryId: "cat-1",
        categoryName: "อาหาร",
        categoryArchived: false,
        currency: "THB",
        periodMonth: "2026-09-01",
        budgetAmount: "5000.00",
        netSpent: "3200.00",
        remaining: "1800.00",
        archivedAt: null,
      },
    ]);
    expect(result.archived).toHaveLength(1);
    expect(result.archived[0].budgetId).toBe("b2");
  });

  it("returns empty active/archived arrays on error rather than throwing (read model)", async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
    const result = await getBudgetSummary(supabase as never, { periodMonth: "2026-09-01", monthStart: "x", monthEnd: "y" });
    expect(result).toEqual({ active: [], archived: [] });
  });
});
