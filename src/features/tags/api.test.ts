import { describe, expect, it } from "vitest";

import { archiveTag, createTag, listTagsForTransactions, renameTag, restoreTag, setTransactionTags } from "./api";

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
  builder.order = chain("order");
  builder.single = async () => resolved;
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

describe("createTag", () => {
  it("sends scope/owner/household/name/created_by", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: { id: "tag-1" }, error: null }) };

    await createTag(supabase as never, { name: "Trip", scope: "PERSONAL", ownerUserId: "user-a", householdId: null, createdBy: "user-a" });

    expect(calls).toContainEqual({
      m: "insert",
      a: [{ name: "Trip", scope: "PERSONAL", owner_user_id: "user-a", household_id: null, created_by: "user-a" }],
    });
  });

  it("throws (does not swallow) a duplicate-name rejection", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "duplicate key", code: "23505" } }) };
    await expect(
      createTag(supabase as never, { name: "Trip", scope: "PERSONAL", ownerUserId: "user-a", householdId: null, createdBy: "user-a" }),
    ).rejects.toBeTruthy();
  });
});

describe("renameTag / archiveTag / restoreTag", () => {
  it("rename issues a name update", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: null, error: null }) };
    await renameTag(supabase as never, "tag-1", "Travel");
    expect(calls).toContainEqual({ m: "update", a: [{ name: "Travel" }] });
  });

  it("archive sets archived_at, restore clears it", async () => {
    const archiveCalls: unknown[] = [];
    const archiveSupabase = { from: () => fakeSupabaseTable((m, a) => archiveCalls.push({ m, a }), { data: null, error: null }) };
    await archiveTag(archiveSupabase as never, "tag-1");
    expect((archiveCalls[0] as { a: [{ archived_at: string }] }).a[0].archived_at).toBeTypeOf("string");

    const restoreCalls: unknown[] = [];
    const restoreSupabase = { from: () => fakeSupabaseTable((m, a) => restoreCalls.push({ m, a }), { data: null, error: null }) };
    await restoreTag(restoreSupabase as never, "tag-1");
    expect(restoreCalls).toContainEqual({ m: "update", a: [{ archived_at: null }] });
  });
});

describe("setTransactionTags", () => {
  it("calls set_transaction_tags with the transaction id and full tag set", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await setTransactionTags(supabase as never, "t1", ["tag-a", "tag-b"]);
    expect(calls).toEqual([{ fn: "set_transaction_tags", args: { p_transaction_id: "t1", p_tag_ids: ["tag-a", "tag-b"] } }]);
  });

  it("surfaces a rejection (e.g. an archived or cross-scope tag) rather than swallowing it", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "Tag is archived", code: "23514" } });
    await expect(setTransactionTags(supabase as never, "t1", ["tag-a"])).rejects.toBeTruthy();
  });
});

describe("listTagsForTransactions", () => {
  it("groups tag rows by transaction id into a Map, one batched query for however many ids", async () => {
    const calls: unknown[] = [];
    const rows = [
      { transaction_id: "t1", tag: { id: "tag-a", name: "เที่ยว" } },
      { transaction_id: "t1", tag: { id: "tag-b", name: "แฟน" } },
      { transaction_id: "t2", tag: { id: "tag-a", name: "เที่ยว" } },
    ];
    const supabase = {
      from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: rows, error: null }),
    };

    const result = await listTagsForTransactions(supabase as never, ["t1", "t2", "t3"]);

    expect(result.get("t1")).toEqual([
      { id: "tag-a", name: "เที่ยว" },
      { id: "tag-b", name: "แฟน" },
    ]);
    expect(result.get("t2")).toEqual([{ id: "tag-a", name: "เที่ยว" }]);
    expect(result.get("t3")).toBeUndefined();
    // Exactly one query regardless of how many transaction ids — no N+1.
    expect(calls.filter((c) => (c as { m: string }).m === "in")).toHaveLength(1);
  });

  it("returns an empty Map without querying when given no ids", async () => {
    let called = false;
    const supabase = { from: () => { called = true; return fakeSupabaseTable(() => {}, { data: [], error: null }); } };
    const result = await listTagsForTransactions(supabase as never, []);
    expect(result.size).toBe(0);
    expect(called).toBe(false);
  });

  it("skips a row whose tag was itself filtered out by RLS (null embed)", async () => {
    const rows = [{ transaction_id: "t1", tag: null }];
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: rows, error: null }) };
    const result = await listTagsForTransactions(supabase as never, ["t1"]);
    expect(result.get("t1") ?? []).toEqual([]);
  });
});
