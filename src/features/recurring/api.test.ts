import { describe, expect, it } from "vitest";

import {
  archiveRecurringTransaction,
  createRecurringTransaction,
  getOccurrence,
  getRecurringTransaction,
  listOccurrencesForRules,
  listRecurringTransactions,
  materializeRecurringOccurrences,
  pauseRecurringTransaction,
  postRecurringOccurrence,
  resumeRecurringTransaction,
  restoreRecurringTransaction,
  setRecurringTransactionTags,
  skipRecurringOccurrence,
  updateRecurringTransaction,
} from "./api";

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
  builder.in = chain("in");
  builder.is = chain("is");
  builder.order = chain("order");
  builder.limit = chain("limit");
  builder.single = async () => resolved;
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

describe("createRecurringTransaction", () => {
  it("sends scope/owner/household/type/name/schedule/optional defaults/created_by", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: { id: "r1" }, error: null }) };

    await createRecurringTransaction(supabase as never, {
      scope: "PERSONAL",
      ownerUserId: "user-a",
      householdId: null,
      transactionType: "EXPENSE",
      name: "เงินเดือน",
      walletId: "w1",
      pocketId: "p1",
      categoryId: "cat-1",
      amount: "25000.00",
      title: null,
      note: null,
      frequency: "MONTHLY",
      intervalCount: 1,
      startDate: "2026-01-31",
      endDate: null,
      createdBy: "user-a",
    });

    expect(calls).toContainEqual({
      m: "insert",
      a: [
        {
          scope: "PERSONAL",
          owner_user_id: "user-a",
          household_id: null,
          transaction_type: "EXPENSE",
          name: "เงินเดือน",
          wallet_id: "w1",
          pocket_id: "p1",
          category_id: "cat-1",
          amount: "25000.00",
          title: null,
          note: null,
          frequency: "MONTHLY",
          interval_count: 1,
          start_date: "2026-01-31",
          end_date: null,
          created_by: "user-a",
        },
      ],
    });
  });

  it("throws (does not swallow) a rejected reference or invalid schedule", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "invalid", code: "23514" } }) };
    await expect(
      createRecurringTransaction(supabase as never, {
        scope: "PERSONAL",
        ownerUserId: "user-a",
        householdId: null,
        transactionType: "EXPENSE",
        name: "x",
        amount: "10.00",
        frequency: "WEEKLY",
        intervalCount: 1,
        startDate: "2026-01-01",
        createdBy: "user-a",
      }),
    ).rejects.toBeTruthy();
  });
});

describe("updateRecurringTransaction / lifecycle", () => {
  it("update sends name/defaults/schedule together", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: null, error: null }) };
    await updateRecurringTransaction(supabase as never, "r1", {
      name: "เงินเดือน v2",
      amount: "26000.00",
      frequency: "MONTHLY",
      intervalCount: 2,
      startDate: "2026-02-01",
      endDate: "2026-12-01",
    });
    expect(calls).toContainEqual({
      m: "update",
      a: [
        {
          name: "เงินเดือน v2",
          wallet_id: null,
          pocket_id: null,
          category_id: null,
          amount: "26000.00",
          title: null,
          note: null,
          frequency: "MONTHLY",
          interval_count: 2,
          start_date: "2026-02-01",
          end_date: "2026-12-01",
        },
      ],
    });
  });

  it("pause sets paused_at, resume clears it", async () => {
    const pauseCalls: unknown[] = [];
    await pauseRecurringTransaction({ from: () => fakeSupabaseTable((m, a) => pauseCalls.push({ m, a }), { data: null, error: null }) } as never, "r1");
    expect((pauseCalls[0] as { a: [{ paused_at: string }] }).a[0].paused_at).toBeTypeOf("string");

    const resumeCalls: unknown[] = [];
    await resumeRecurringTransaction({ from: () => fakeSupabaseTable((m, a) => resumeCalls.push({ m, a }), { data: null, error: null }) } as never, "r1");
    expect(resumeCalls).toContainEqual({ m: "update", a: [{ paused_at: null }] });
  });

  it("archive sets archived_at, restore clears it", async () => {
    const archiveCalls: unknown[] = [];
    await archiveRecurringTransaction({ from: () => fakeSupabaseTable((m, a) => archiveCalls.push({ m, a }), { data: null, error: null }) } as never, "r1");
    expect((archiveCalls[0] as { a: [{ archived_at: string }] }).a[0].archived_at).toBeTypeOf("string");

    const restoreCalls: unknown[] = [];
    await restoreRecurringTransaction({ from: () => fakeSupabaseTable((m, a) => restoreCalls.push({ m, a }), { data: null, error: null }) } as never, "r1");
    expect(restoreCalls).toContainEqual({ m: "update", a: [{ archived_at: null }] });
  });

  it("restore surfaces a failed reactivation rather than swallowing it", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "boom" } }) };
    await expect(restoreRecurringTransaction(supabase as never, "r1")).rejects.toBeTruthy();
  });
});

describe("setRecurringTransactionTags", () => {
  it("calls set_recurring_transaction_tags with the rule id and full tag set", async () => {
    const { supabase, calls } = fakeRpc({ data: "r1", error: null });
    await setRecurringTransactionTags(supabase as never, "r1", ["tag-a", "tag-b"]);
    expect(calls).toEqual([{ fn: "set_recurring_transaction_tags", args: { p_recurring_id: "r1", p_tag_ids: ["tag-a", "tag-b"] } }]);
  });

  it("surfaces a rejection (e.g. an archived tag) rather than swallowing it", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "Tag is archived", code: "23514" } });
    await expect(setRecurringTransactionTags(supabase as never, "r1", ["tag-a"])).rejects.toBeTruthy();
  });
});

describe("materializeRecurringOccurrences", () => {
  it("calls materialize_recurring_occurrences with scope and household id", async () => {
    const { supabase, calls } = fakeRpc({ data: null, error: null });
    await materializeRecurringOccurrences(supabase as never, { scope: "HOUSEHOLD", householdId: "h1" });
    expect(calls).toEqual([{ fn: "materialize_recurring_occurrences", args: { p_scope: "HOUSEHOLD", p_household_id: "h1" } }]);
  });

  it("swallows an error rather than throwing (read-freshness helper, not a mutation the caller awaits for success)", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "boom" } });
    await expect(materializeRecurringOccurrences(supabase as never, { scope: "PERSONAL" })).resolves.toBeUndefined();
  });
});

describe("postRecurringOccurrence / skipRecurringOccurrence", () => {
  it("post sends every posting field and returns the new transaction id", async () => {
    const { supabase, calls } = fakeRpc({ data: "txn-1", error: null });
    const result = await postRecurringOccurrence(supabase as never, {
      occurrenceId: "occ-1",
      walletId: "w1",
      pocketId: "p1",
      categoryId: "cat-1",
      amount: "25000.00",
      title: "เงินเดือน",
      note: null,
      occurredAt: "2026-09-25T12:00:00.000Z",
      tagIds: ["tag-a"],
    });
    expect(result).toBe("txn-1");
    expect(calls).toEqual([
      {
        fn: "post_recurring_occurrence",
        args: {
          p_occurrence_id: "occ-1",
          p_wallet_id: "w1",
          p_pocket_id: "p1",
          p_category_id: "cat-1",
          p_amount: "25000.00",
          p_title: "เงินเดือน",
          p_note: null,
          p_occurred_at: "2026-09-25T12:00:00.000Z",
          p_tag_ids: ["tag-a"],
        },
      },
    ]);
  });

  it("post surfaces a rejection (e.g. already posted) rather than swallowing it", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "already POSTED", code: "23514" } });
    await expect(
      postRecurringOccurrence(supabase as never, { occurrenceId: "occ-1", walletId: "w1", pocketId: "p1", categoryId: "cat-1", amount: "10.00" }),
    ).rejects.toBeTruthy();
  });

  it("skip calls skip_recurring_occurrence with the occurrence id", async () => {
    const { supabase, calls } = fakeRpc({ data: "occ-1", error: null });
    await skipRecurringOccurrence(supabase as never, "occ-1");
    expect(calls).toEqual([{ fn: "skip_recurring_occurrence", args: { p_occurrence_id: "occ-1" } }]);
  });

  it("skip surfaces a rejection rather than swallowing it", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "already SKIPPED", code: "23514" } });
    await expect(skipRecurringOccurrence(supabase as never, "occ-1")).rejects.toBeTruthy();
  });
});

describe("getRecurringTransaction", () => {
  it("returns null (not throw) when not found or inaccessible", async () => {
    let call = 0;
    const supabase = {
      from: (table: string) => {
        call += 1;
        if (table === "recurring_transactions") return fakeSupabaseTable(() => {}, { data: null, error: null });
        return fakeSupabaseTable(() => {}, { data: [], error: null });
      },
    };
    expect(await getRecurringTransaction(supabase as never, "r1")).toBeNull();
    expect(call).toBe(1); // never queries tags for a rule that doesn't exist
  });

  it("maps a found row, resolving stale wallet/pocket/category flags and merging its tags", async () => {
    const row = {
      id: "r1",
      scope: "PERSONAL",
      owner_user_id: "user-a",
      household_id: null,
      transaction_type: "EXPENSE",
      name: "เงินเดือน",
      amount: "25000.00",
      title: null,
      note: null,
      frequency: "MONTHLY",
      interval_count: 1,
      start_date: "2026-01-31",
      end_date: null,
      paused_at: null,
      archived_at: null,
      wallet_id: "w1",
      wallet: { name: "KBank", is_archived: true },
      pocket_id: "p1",
      pocket: { name: "ใช้จ่าย", is_archived: false },
      category_id: "cat-1",
      category: { name: "รายรับ", archived_at: null },
    };
    const tagRows = [{ recurring_transaction_id: "r1", tag: { id: "tag-a", name: "งาน", archived_at: null } }];

    const supabase = {
      from: (table: string) => {
        if (table === "recurring_transactions") return fakeSupabaseTable(() => {}, { data: row, error: null });
        return fakeSupabaseTable(() => {}, { data: tagRows, error: null });
      },
    };

    const result = await getRecurringTransaction(supabase as never, "r1");
    expect(result).toEqual({
      recurringId: "r1",
      scope: "PERSONAL",
      ownerUserId: "user-a",
      householdId: null,
      transactionType: "EXPENSE",
      name: "เงินเดือน",
      amount: "25000.00",
      title: null,
      note: null,
      frequency: "MONTHLY",
      intervalCount: 1,
      startDate: "2026-01-31",
      endDate: null,
      pausedAt: null,
      archivedAt: null,
      walletId: "w1",
      walletName: "KBank",
      walletArchived: true, // stale flag surfaced, never silently hidden
      pocketId: "p1",
      pocketName: "ใช้จ่าย",
      pocketArchived: false,
      categoryId: "cat-1",
      categoryName: "รายรับ",
      categoryArchived: false,
      tags: [{ id: "tag-a", name: "งาน", archivedAt: null }],
    });
  });
});

describe("listRecurringTransactions", () => {
  it("batches tags for every returned rule in one query, never one per rule", async () => {
    const calls: unknown[] = [];
    const rows = [
      {
        id: "r1", scope: "PERSONAL", owner_user_id: "u", household_id: null, transaction_type: "EXPENSE", name: "A", amount: "10.00",
        title: null, note: null, frequency: "WEEKLY", interval_count: 1, start_date: "2026-01-01", end_date: null, paused_at: null, archived_at: null,
        wallet_id: null, wallet: null, pocket_id: null, pocket: null, category_id: null, category: null,
      },
      {
        id: "r2", scope: "PERSONAL", owner_user_id: "u", household_id: null, transaction_type: "INCOME", name: "B", amount: "20.00",
        title: null, note: null, frequency: "MONTHLY", interval_count: 1, start_date: "2026-01-01", end_date: null, paused_at: null, archived_at: null,
        wallet_id: null, wallet: null, pocket_id: null, pocket: null, category_id: null, category: null,
      },
    ];
    const supabase = {
      from: (table: string) => {
        calls.push(table);
        if (table === "recurring_transactions") return fakeSupabaseTable(() => {}, { data: rows, error: null });
        return fakeSupabaseTable(() => {}, { data: [], error: null });
      },
    };

    const result = await listRecurringTransactions(supabase as never, { scope: "PERSONAL" });
    expect(result).toHaveLength(2);
    expect(calls.filter((t) => t === "recurring_transaction_tags")).toHaveLength(1);
  });

  it("returns an empty array on error rather than throwing (read model)", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "boom" } }) };
    expect(await listRecurringTransactions(supabase as never, { scope: "PERSONAL" })).toEqual([]);
  });
});

describe("occurrence read model", () => {
  const ruleRow = {
    id: "r1",
    scope: "PERSONAL" as const,
    owner_user_id: "user-a",
    household_id: null,
    transaction_type: "EXPENSE" as const,
    name: "เงินเดือน",
    amount: "25000.00",
    title: null,
    note: null,
    wallet_id: "w1",
    wallet: { name: "KBank", is_archived: false, currency: "THB" },
    pocket_id: "p1",
    pocket: { name: "ใช้จ่าย", is_archived: false },
    category_id: "cat-1",
    category: { name: "รายรับ", archived_at: null },
  };

  it("maps an UPCOMING occurrence with no posted transaction to postedTransactionVoided: false", async () => {
    const occurrenceRow = {
      id: "occ-1",
      due_date: "2026-09-25",
      status: "UPCOMING",
      posted_transaction_id: null,
      posted_at: null,
      skipped_at: null,
      recurring_transaction: ruleRow,
      posted_transaction: null,
    };
    const supabase = {
      from: (table: string) => {
        if (table === "recurring_occurrences") return fakeSupabaseTable(() => {}, { data: occurrenceRow, error: null });
        return fakeSupabaseTable(() => {}, { data: [], error: null });
      },
    };
    const result = await getOccurrence(supabase as never, "occ-1");
    expect(result?.status).toBe("UPCOMING");
    expect(result?.postedTransactionVoided).toBe(false);
    expect(result?.walletCurrency).toBe("THB");
  });

  it("surfaces a POSTED occurrence whose linked transaction was voided, rather than hiding it", async () => {
    const occurrenceRow = {
      id: "occ-2",
      due_date: "2026-08-25",
      status: "POSTED",
      posted_transaction_id: "txn-1",
      posted_at: "2026-08-25T05:00:00.000Z",
      skipped_at: null,
      recurring_transaction: ruleRow,
      posted_transaction: { deleted_at: "2026-08-26T00:00:00.000Z" },
    };
    const supabase = {
      from: (table: string) => {
        if (table === "recurring_occurrences") return fakeSupabaseTable(() => {}, { data: occurrenceRow, error: null });
        return fakeSupabaseTable(() => {}, { data: [], error: null });
      },
    };
    const result = await getOccurrence(supabase as never, "occ-2");
    expect(result?.status).toBe("POSTED");
    expect(result?.postedTransactionVoided).toBe(true);
  });

  it("listOccurrencesForRules returns [] without querying when given no rule ids", async () => {
    let called = false;
    const supabase = { from: () => { called = true; return fakeSupabaseTable(() => {}, { data: [], error: null }); } };
    expect(await listOccurrencesForRules(supabase as never, [])).toEqual([]);
    expect(called).toBe(false);
  });
});
