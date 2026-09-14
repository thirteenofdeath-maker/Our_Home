import { describe, expect, it } from "vitest";

import {
  createExpenseAdjustment,
  getAdjustmentOrigin,
  getRefundableSummary,
  listAdjustmentInfoForTransactions,
  listAdjustmentsForOriginal,
  listAdjustmentTransactionIds,
} from "./api";

function fakeSupabaseTable(onCall: (method: string, args: unknown[]) => void, resolved: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    onCall(method, args);
    return builder;
  };
  builder.select = chain("select");
  builder.eq = chain("eq");
  builder.in = chain("in");
  builder.order = chain("order");
  builder.maybeSingle = async () => resolved;
  builder.then = (resolve: (v: { data: unknown; error: unknown }) => void) => resolve(resolved);
  return builder;
}

function fakeRpc(resolved: { data: unknown; error: unknown }) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const supabase = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return resolved;
    },
  };
  return { supabase, calls };
}

describe("createExpenseAdjustment", () => {
  it("calls create_expense_adjustment_transaction with the correct arguments, defaulting empty tags to null", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await createExpenseAdjustment(supabase as never, {
      originalExpenseId: "orig-1",
      adjustmentKind: "REFUND",
      walletId: "w1",
      pocketId: "p1",
      amount: "500.00",
      title: "คืนสินค้า",
      note: null,
      occurredAt: "2026-09-10T12:00:00.000Z",
    });
    expect(calls).toEqual([
      {
        fn: "create_expense_adjustment_transaction",
        args: {
          p_original_expense_id: "orig-1",
          p_adjustment_kind: "REFUND",
          p_wallet_id: "w1",
          p_pocket_id: "p1",
          p_amount: "500.00",
          p_title: "คืนสินค้า",
          p_note: null,
          p_occurred_at: "2026-09-10T12:00:00.000Z",
          p_tag_ids: null,
        },
      },
    ]);
  });

  it("forwards tag ids when given, and throws (does not swallow) a rejection", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await createExpenseAdjustment(supabase as never, {
      originalExpenseId: "orig-1",
      adjustmentKind: "REIMBURSEMENT",
      walletId: "w1",
      pocketId: "p1",
      amount: "400.00",
      tagIds: ["tag-a"],
    });
    expect((calls[0].args as Record<string, unknown>).p_tag_ids).toEqual(["tag-a"]);
    expect((calls[0].args as Record<string, unknown>).p_adjustment_kind).toBe("REIMBURSEMENT");

    const rejecting = fakeRpc({ data: null, error: { message: "would exceed original amount", code: "23514" } });
    await expect(
      createExpenseAdjustment(rejecting.supabase as never, {
        originalExpenseId: "orig-1",
        adjustmentKind: "REFUND",
        walletId: "w1",
        pocketId: "p1",
        amount: "9999.00",
      }),
    ).rejects.toBeTruthy();
  });
});

describe("getRefundableSummary", () => {
  it("normalizes every figure to a decimal string", async () => {
    const supabase = {
      rpc: async () => ({
        data: { original_amount: 1500, active_refund_total: 500, active_reimbursement_total: 0, remaining_adjustable_amount: 1000 },
        error: null,
      }),
    };
    const result = await getRefundableSummary(supabase as never, "orig-1");
    expect(result).toEqual({
      originalAmount: "1500.00",
      activeRefundTotal: "500.00",
      activeReimbursementTotal: "0.00",
      remainingAdjustableAmount: "1000.00",
    });
  });

  it("returns null on error rather than throwing (read model, not a mutation)", async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: "not found" } }) };
    expect(await getRefundableSummary(supabase as never, "orig-1")).toBeNull();
  });
});

describe("getAdjustmentOrigin", () => {
  it("maps a found row to kind/original title/category", async () => {
    const supabase = {
      from: () =>
        fakeSupabaseTable(() => {}, {
          data: {
            adjustment_kind: "REFUND",
            original_expense_transaction_id: "orig-1",
            original: { title: "สินค้า", category: { name: "ช้อปปิ้ง" } },
          },
          error: null,
        }),
    };
    const result = await getAdjustmentOrigin(supabase as never, "t1");
    expect(result).toEqual({
      kind: "REFUND",
      originalTransactionId: "orig-1",
      originalTitle: "สินค้า",
      originalCategoryName: "ช้อปปิ้ง",
    });
  });

  it("returns null when the transaction is not an adjustment", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: null }) };
    expect(await getAdjustmentOrigin(supabase as never, "t1")).toBeNull();
  });
});

describe("listAdjustmentInfoForTransactions", () => {
  it("batches into a Map keyed by transaction id — one query regardless of count", async () => {
    const calls: unknown[] = [];
    const rows = [
      { transaction_id: "t1", adjustment_kind: "REFUND", original_expense_transaction_id: "orig-1", original: { title: "สินค้า" } },
      { transaction_id: "t2", adjustment_kind: "REIMBURSEMENT", original_expense_transaction_id: "orig-2", original: { title: "ค่าโรงแรม" } },
    ];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: rows, error: null }) };

    const result = await listAdjustmentInfoForTransactions(supabase as never, ["t1", "t2", "t3"]);

    expect(result.get("t1")).toEqual({ kind: "REFUND", originalTransactionId: "orig-1", originalTitle: "สินค้า" });
    expect(result.get("t2")).toEqual({ kind: "REIMBURSEMENT", originalTransactionId: "orig-2", originalTitle: "ค่าโรงแรม" });
    expect(result.get("t3")).toBeUndefined();
    expect(calls.filter((c) => (c as { m: string }).m === "in")).toHaveLength(1);
  });

  it("returns an empty Map without querying when given no ids", async () => {
    let called = false;
    const supabase = {
      from: () => {
        called = true;
        return fakeSupabaseTable(() => {}, { data: [], error: null });
      },
    };
    const result = await listAdjustmentInfoForTransactions(supabase as never, []);
    expect(result.size).toBe(0);
    expect(called).toBe(false);
  });
});

describe("listAdjustmentTransactionIds", () => {
  it("returns every adjustment id when no kind is given", async () => {
    const supabase = {
      from: () => fakeSupabaseTable(() => {}, { data: [{ transaction_id: "t1" }, { transaction_id: "t2" }], error: null }),
    };
    expect(await listAdjustmentTransactionIds(supabase as never)).toEqual(["t1", "t2"]);
  });

  it("filters by kind when given", async () => {
    const calls: unknown[] = [];
    const supabase = {
      from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: [{ transaction_id: "t1" }], error: null }),
    };
    const result = await listAdjustmentTransactionIds(supabase as never, "REIMBURSEMENT");
    expect(result).toEqual(["t1"]);
    expect(calls).toContainEqual({ m: "eq", a: ["adjustment_kind", "REIMBURSEMENT"] });
  });
});

describe("listAdjustmentsForOriginal", () => {
  it("merges the link query with a second entries query by transaction id (no direct FK between the two tables)", async () => {
    const links = [
      { transaction_id: "adj-1", adjustment_kind: "REFUND", transaction: { deleted_at: null, occurred_at: "2026-09-05T00:00:00.000Z" } },
      { transaction_id: "adj-2", adjustment_kind: "REIMBURSEMENT", transaction: { deleted_at: "2026-09-06T00:00:00.000Z", occurred_at: "2026-09-06T00:00:00.000Z" } },
    ];
    const entries = [
      { transaction_id: "adj-1", amount: "500.00", wallet: { name: "SCB" }, pocket: { name: "ใช้จ่าย" } },
      { transaction_id: "adj-2", amount: "300.00", wallet: { name: "KBank" }, pocket: { name: "ทั่วไป" } },
    ];

    let call = 0;
    const supabase = {
      from: (table: string) => {
        call += 1;
        if (table === "expense_adjustments") return fakeSupabaseTable(() => {}, { data: links, error: null });
        expect(table).toBe("transaction_entries");
        return fakeSupabaseTable(() => {}, { data: entries, error: null });
      },
    };

    const result = await listAdjustmentsForOriginal(supabase as never, "orig-1");
    expect(call).toBe(2);
    expect(result).toEqual([
      { transactionId: "adj-1", kind: "REFUND", amount: "500.00", occurredAt: "2026-09-05T00:00:00.000Z", walletName: "SCB", pocketName: "ใช้จ่าย", voidedAt: null },
      {
        transactionId: "adj-2",
        kind: "REIMBURSEMENT",
        amount: "300.00",
        occurredAt: "2026-09-06T00:00:00.000Z",
        walletName: "KBank",
        pocketName: "ทั่วไป",
        voidedAt: "2026-09-06T00:00:00.000Z",
      },
    ]);
  });
});
