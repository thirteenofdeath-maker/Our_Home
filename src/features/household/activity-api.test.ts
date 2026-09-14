import { describe, expect, it } from "vitest";

import { getHouseholdExpenseActivity, loadHouseholdExpenseActivity } from "./activity-api";

const params = { householdId: "household-1", from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" };

describe("getHouseholdExpenseActivity", () => {
  it("maps the wire shape and throws (does not swallow) on RPC error — callers that need the raw failure use this", async () => {
    const wireItems = [
      {
        transaction_id: "t1",
        original_transaction_id: "t1",
        is_adjustment: false,
        category_id: "cat-1",
        category_name: "ค่าไฟ",
        currency: "THB",
        amount: "-400.00",
        occurred_at: "2026-08-15T00:00:00.000Z",
        payer_user_id: "user-a",
        payer_display_name: "สมชาย",
      },
    ];
    const supabase = { rpc: async () => ({ data: wireItems, error: null }) };
    const items = await getHouseholdExpenseActivity(supabase as never, params);
    expect(items).toEqual([
      {
        transactionId: "t1",
        originalTransactionId: "t1",
        isAdjustment: false,
        categoryId: "cat-1",
        categoryName: "ค่าไฟ",
        currency: "THB",
        amount: "-400.00",
        occurredAt: "2026-08-15T00:00:00.000Z",
        payerUserId: "user-a",
        payerDisplayName: "สมชาย",
      },
    ]);

    const failingSupabase = { rpc: async () => ({ data: null, error: { message: "permission denied", code: "42501" } }) };
    await expect(getHouseholdExpenseActivity(failingSupabase as never, params)).rejects.toBeTruthy();
  });
});

describe("loadHouseholdExpenseActivity — Section 4 corrective patch", () => {
  it("returns a genuinely empty result as { status: 'ok', items: [] } — the EmptyState case", async () => {
    const supabase = { rpc: async () => ({ data: [], error: null }) };
    const result = await loadHouseholdExpenseActivity(supabase as never, params);
    expect(result).toEqual({ status: "ok", items: [] });
  });

  it("returns a load failure as { status: 'error' } — NEVER the same shape as a genuine empty result", async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: "relation does not exist", code: "42P01" } }) };
    const result = await loadHouseholdExpenseActivity(supabase as never, params);
    expect(result).toEqual({ status: "error" });
    expect(result).not.toEqual({ status: "ok", items: [] });
  });

  it("returns { status: 'error' } for an authorization rejection too — an unauthorized caller must never be told 'no household activity'", async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: "Household household-1 not found or not authorized", code: "42501" } }) };
    const result = await loadHouseholdExpenseActivity(supabase as never, params);
    expect(result).toEqual({ status: "error" });
  });

  it("never leaks the raw error message/code into the returned result — only a status flag reaches the caller", async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: "permission denied for table household_expense_attributions", code: "42501" } }) };
    const result = await loadHouseholdExpenseActivity(supabase as never, params);
    expect(JSON.stringify(result)).not.toContain("permission denied");
    expect(JSON.stringify(result)).not.toContain("household_expense_attributions");
  });

  it("returns real rows as { status: 'ok', items: [...] } — the success case, distinct from both empty and error", async () => {
    const supabase = {
      rpc: async () => ({
        data: [
          {
            transaction_id: "t1",
            original_transaction_id: "t1",
            is_adjustment: false,
            category_id: "cat-1",
            category_name: "ค่าไฟ",
            currency: "THB",
            amount: "-400.00",
            occurred_at: "2026-08-15T00:00:00.000Z",
            payer_user_id: "user-a",
            payer_display_name: "สมชาย",
          },
        ],
        error: null,
      }),
    };
    const result = await loadHouseholdExpenseActivity(supabase as never, params);
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.items).toHaveLength(1);
  });
});
