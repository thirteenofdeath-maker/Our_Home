import { describe, expect, it } from "vitest";

import {
  createIncomeExpense,
  createPocketTransfer,
  createWalletTransfer,
  groupHistoryRows,
  groupSearchRows,
  restoreTransaction,
  updateIncomeExpense,
  voidTransaction,
  type RawHistoryRow,
} from "./api";

function row(overrides: Partial<RawHistoryRow>): RawHistoryRow {
  return {
    id: "entry",
    amount: "100.00",
    wallet_id: "wallet-a",
    wallet: { name: "Cash" },
    pocket: { name: "Main" },
    transaction: {
      id: "transaction",
      transaction_type: "INCOME",
      title: null,
      note: null,
      occurred_at: "2026-09-08T12:00:00.000Z",
      deleted_at: null,
      category: { name: "Salary" },
      creator: { display_name: "Alex" },
    },
    ...overrides,
  };
}

describe("transaction history logical grouping", () => {
  it("shows income as one logical row with historical context", () => {
    const income = row({});
    expect(groupHistoryRows([income], [income], "wallet-a")).toEqual([
      expect.objectContaining({
        transactionId: "transaction",
        transactionType: "INCOME",
        amount: "100.00",
        categoryName: "Salary",
        walletName: "Cash",
        pocketName: "Main",
        creatorName: "Alex",
      }),
    ]);
  });

  it("normalizes PostgREST numeric runtime numbers before returning history", () => {
    const income = row({ amount: 125.5 });
    const [item] = groupHistoryRows([income], [income], "wallet-a");

    expect(item.amount).toBe("125.50");
    expect(() => item.amount.startsWith("-")).not.toThrow();
  });

  it("collapses a two-entry pocket transfer into one row", () => {
    const debit = row({
      id: "debit",
      amount: "-25.00",
      pocket: { name: "Main" },
      transaction: { ...row({}).transaction!, id: "transfer", transaction_type: "TRANSFER", category: null },
    });
    const credit = row({
      id: "credit",
      amount: "25.00",
      pocket: { name: "Food" },
      transaction: debit.transaction,
    });
    const items = groupHistoryRows([debit, credit], [debit, credit], "wallet-a");
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(expect.objectContaining({
      amount: "25.00",
      pocketTransfer: { fromPocketName: "Main", toPocketName: "Food", amount: "25.00" },
    }));
  });

  it("expands a wallet transfer and keeps amount signed for viewed wallet", () => {
    const debit = row({
      id: "debit",
      amount: "-40.00",
      transaction: { ...row({}).transaction!, id: "transfer", transaction_type: "TRANSFER", category: null },
    });
    const credit = row({
      id: "credit",
      amount: "40.00",
      wallet_id: "wallet-b",
      wallet: { name: "Bank" },
      pocket: { name: "Savings" },
      transaction: debit.transaction,
    });
    const items = groupHistoryRows([debit], [debit, credit], "wallet-a");
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(expect.objectContaining({
      amount: "-40.00",
      walletTransfer: {
        fromWalletName: "Cash",
        fromPocketName: "Main",
        toWalletName: "Bank",
        toPocketName: "Savings",
      },
    }));
  });
});

describe("groupSearchRows (Phase B search — no single viewed wallet, status is a query filter not a given)", () => {
  it("does NOT exclude a voided transaction (status filtering happens in the DB query, not here)", () => {
    const voided = row({ transaction: { ...row({}).transaction!, deleted_at: "2026-09-10T00:00:00.000Z" } });
    const items = groupSearchRows([voided], [voided]);
    expect(items).toEqual([expect.objectContaining({ voidedAt: "2026-09-10T00:00:00.000Z" })]);
  });

  it("keeps active items' voidedAt null", () => {
    const active = row({});
    const items = groupSearchRows([active], [active]);
    expect(items[0].voidedAt).toBeNull();
  });

  it("attaches per-row currency for income/expense (multi-wallet, multi-currency safety)", () => {
    const usd = row({ wallet: { name: "Travel Card", currency: "USD" } });
    const items = groupSearchRows([usd], [usd]);
    expect(items[0].currency).toBe("USD");
  });

  it("frames a pocket transfer with a positive amount and pocketTransfer metadata, without needing a viewed wallet", () => {
    const debit = row({
      id: "debit",
      amount: "-25.00",
      pocket: { name: "Main" },
      transaction: { ...row({}).transaction!, id: "transfer", transaction_type: "TRANSFER", category: null },
    });
    const credit = row({ id: "credit", amount: "25.00", pocket: { name: "Food" }, transaction: debit.transaction });
    const items = groupSearchRows([debit, credit], [debit, credit]);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        amount: "25.00",
        pocketTransfer: { fromPocketName: "Main", toPocketName: "Food", amount: "25.00" },
      }),
    );
    expect(items[0].walletTransfer).toBeUndefined();
  });

  it("frames a wallet transfer distinctly from a pocket transfer (walletTransfer, not pocketTransfer)", () => {
    const debit = row({
      id: "debit",
      amount: "-40.00",
      wallet: { name: "Cash" },
      transaction: { ...row({}).transaction!, id: "transfer", transaction_type: "TRANSFER", category: null },
    });
    const credit = row({
      id: "credit",
      amount: "40.00",
      wallet_id: "wallet-b",
      wallet: { name: "Bank", currency: "USD" },
      pocket: { name: "Savings" },
      transaction: debit.transaction,
    });
    const items = groupSearchRows([debit, credit], [debit, credit]);
    expect(items).toHaveLength(1);
    expect(items[0].pocketTransfer).toBeUndefined();
    expect(items[0]).toEqual(
      expect.objectContaining({
        walletTransfer: { fromWalletName: "Cash", fromPocketName: "Main", toWalletName: "Bank", toPocketName: "Savings" },
        currency: "USD",
      }),
    );
  });
});

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

describe("updateIncomeExpense", () => {
  it("calls update_income_expense_transaction with the correct arguments and never sends a wallet id", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await updateIncomeExpense(supabase as never, {
      transactionId: "t1",
      pocketId: "p2",
      categoryId: "c1",
      amount: "700.00",
      title: "Lunch",
      note: null,
      occurredAt: "2026-09-10T12:00:00.000Z",
    });
    expect(calls).toEqual([
      {
        fn: "update_income_expense_transaction",
        args: {
          p_transaction_id: "t1",
          p_pocket_id: "p2",
          p_category_id: "c1",
          p_amount: "700.00",
          p_title: "Lunch",
          p_note: null,
          p_occurred_at: "2026-09-10T12:00:00.000Z",
          p_tag_ids: null,
        },
      },
    ]);
  });

  it("throws (does not swallow) when the database rejects the edit", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "archived pocket", code: "23514" } });
    await expect(
      updateIncomeExpense(supabase as never, {
        transactionId: "t1",
        pocketId: "p2",
        categoryId: "c1",
        amount: "700.00",
      }),
    ).rejects.toBeTruthy();
  });
});

describe("voidTransaction / restoreTransaction", () => {
  it("void sends the transaction id and reason (null when omitted)", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await voidTransaction(supabase as never, "t1");
    expect(calls).toEqual([{ fn: "void_transaction", args: { p_transaction_id: "t1", p_void_reason: null } }]);
  });

  it("void forwards an explicit reason", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await voidTransaction(supabase as never, "t1", "Duplicate entry");
    expect(calls).toEqual([{ fn: "void_transaction", args: { p_transaction_id: "t1", p_void_reason: "Duplicate entry" } }]);
  });

  it("void surfaces a double-void rejection rather than swallowing it", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "already voided", code: "22023" } });
    await expect(voidTransaction(supabase as never, "t1")).rejects.toBeTruthy();
  });

  it("restore sends only the transaction id", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await restoreTransaction(supabase as never, "t1");
    expect(calls).toEqual([{ fn: "restore_transaction", args: { p_transaction_id: "t1" } }]);
  });

  it("restore surfaces an archived-dependency rejection rather than swallowing it", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "wallet archived", code: "23514" } });
    await expect(restoreTransaction(supabase as never, "t1")).rejects.toBeTruthy();
  });
});

describe("Phase C: tag ids thread through the create_* / update RPC calls", () => {
  it("createIncomeExpense omits p_tag_ids by default and forwards it when given", async () => {
    const noTags = fakeRpc({ data: "t1", error: null });
    await createIncomeExpense(noTags.supabase as never, {
      transactionType: "EXPENSE",
      walletId: "w1",
      pocketId: "p1",
      categoryId: "c1",
      amount: "100.00",
    });
    expect((noTags.calls[0].args as Record<string, unknown>).p_tag_ids).toBeNull();

    const withTags = fakeRpc({ data: "t1", error: null });
    await createIncomeExpense(withTags.supabase as never, {
      transactionType: "EXPENSE",
      walletId: "w1",
      pocketId: "p1",
      categoryId: "c1",
      amount: "100.00",
      tagIds: ["tag-a", "tag-b"],
    });
    expect((withTags.calls[0].args as Record<string, unknown>).p_tag_ids).toEqual(["tag-a", "tag-b"]);
  });

  it("createPocketTransfer and createWalletTransfer also forward tag ids", async () => {
    const pocket = fakeRpc({ data: "t1", error: null });
    await createPocketTransfer(pocket.supabase as never, {
      walletId: "w1",
      fromPocketId: "p1",
      toPocketId: "p2",
      amount: "50.00",
      tagIds: ["tag-a"],
    });
    expect((pocket.calls[0].args as Record<string, unknown>).p_tag_ids).toEqual(["tag-a"]);

    const wallet = fakeRpc({ data: "t1", error: null });
    await createWalletTransfer(wallet.supabase as never, {
      fromWalletId: "w1",
      fromPocketId: "p1",
      toWalletId: "w2",
      toPocketId: "p2",
      amount: "50.00",
      tagIds: ["tag-b"],
    });
    expect((wallet.calls[0].args as Record<string, unknown>).p_tag_ids).toEqual(["tag-b"]);
  });

  it("updateIncomeExpense: omitting tagIds means 'leave unchanged' (null), passing [] means 'clear all'", async () => {
    const unchanged = fakeRpc({ data: "t1", error: null });
    await updateIncomeExpense(unchanged.supabase as never, {
      transactionId: "t1",
      pocketId: "p1",
      categoryId: "c1",
      amount: "100.00",
    });
    expect((unchanged.calls[0].args as Record<string, unknown>).p_tag_ids).toBeNull();

    const cleared = fakeRpc({ data: "t1", error: null });
    await updateIncomeExpense(cleared.supabase as never, {
      transactionId: "t1",
      pocketId: "p1",
      categoryId: "c1",
      amount: "100.00",
      tagIds: [],
    });
    expect((cleared.calls[0].args as Record<string, unknown>).p_tag_ids).toEqual([]);
  });
});
