import { describe, expect, it } from "vitest";

import { archiveTemplate, createTemplate, getTemplate, listTemplates, restoreTemplate, setTemplateTags, updateTemplate } from "./api";

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

describe("createTemplate", () => {
  it("sends scope/owner/household/type/name/optional defaults/created_by", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: { id: "t1" }, error: null }) };

    await createTemplate(supabase as never, {
      scope: "PERSONAL",
      ownerUserId: "user-a",
      householdId: null,
      transactionType: "EXPENSE",
      name: "กาแฟตอนเช้า",
      walletId: "w1",
      pocketId: "p1",
      categoryId: "cat-1",
      amount: "60.00",
      title: "กาแฟ",
      note: null,
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
          name: "กาแฟตอนเช้า",
          wallet_id: "w1",
          pocket_id: "p1",
          category_id: "cat-1",
          amount: "60.00",
          title: "กาแฟ",
          note: null,
          created_by: "user-a",
        },
      ],
    });
  });

  it("defaults every optional field to null when omitted", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: { id: "t1" }, error: null }) };

    await createTemplate(supabase as never, {
      scope: "PERSONAL",
      ownerUserId: "user-a",
      householdId: null,
      transactionType: "INCOME",
      name: "เงินเดือน",
      createdBy: "user-a",
    });

    const insertCall = calls.find((c) => (c as { m: string }).m === "insert") as { a: [Record<string, unknown>] };
    expect(insertCall.a[0]).toMatchObject({ wallet_id: null, pocket_id: null, category_id: null, amount: null, title: null, note: null });
  });

  it("throws (does not swallow) a duplicate-name or invalid-reference rejection", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "duplicate key", code: "23505" } }) };
    await expect(
      createTemplate(supabase as never, { scope: "PERSONAL", ownerUserId: "user-a", householdId: null, transactionType: "EXPENSE", name: "กาแฟ", createdBy: "user-a" }),
    ).rejects.toBeTruthy();
  });
});

describe("updateTemplate / archiveTemplate / restoreTemplate", () => {
  it("update sends name and every optional field (null when omitted)", async () => {
    const calls: unknown[] = [];
    const supabase = { from: () => fakeSupabaseTable((m, a) => calls.push({ m, a }), { data: null, error: null }) };
    await updateTemplate(supabase as never, "t1", { name: "กาแฟตอนเช้า v2" });
    expect(calls).toContainEqual({
      m: "update",
      a: [{ name: "กาแฟตอนเช้า v2", wallet_id: null, pocket_id: null, category_id: null, amount: null, title: null, note: null }],
    });
  });

  it("archive sets archived_at, restore clears it", async () => {
    const archiveCalls: unknown[] = [];
    const archiveSupabase = { from: () => fakeSupabaseTable((m, a) => archiveCalls.push({ m, a }), { data: null, error: null }) };
    await archiveTemplate(archiveSupabase as never, "t1");
    expect((archiveCalls[0] as { a: [{ archived_at: string }] }).a[0].archived_at).toBeTypeOf("string");

    const restoreCalls: unknown[] = [];
    const restoreSupabase = { from: () => fakeSupabaseTable((m, a) => restoreCalls.push({ m, a }), { data: null, error: null }) };
    await restoreTemplate(restoreSupabase as never, "t1");
    expect(restoreCalls).toContainEqual({ m: "update", a: [{ archived_at: null }] });
  });

  it("restore surfaces a duplicate-active-name conflict rather than swallowing it", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "duplicate key", code: "23505" } }) };
    await expect(restoreTemplate(supabase as never, "t1")).rejects.toBeTruthy();
  });
});

describe("setTemplateTags", () => {
  it("calls set_template_tags with the template id and full tag set", async () => {
    const { supabase, calls } = fakeRpc({ data: "t1", error: null });
    await setTemplateTags(supabase as never, "t1", ["tag-a", "tag-b"]);
    expect(calls).toEqual([{ fn: "set_template_tags", args: { p_template_id: "t1", p_tag_ids: ["tag-a", "tag-b"] } }]);
  });

  it("surfaces a rejection (e.g. an archived or cross-scope tag) rather than swallowing it", async () => {
    const { supabase } = fakeRpc({ data: null, error: { message: "Tag is archived", code: "23514" } });
    await expect(setTemplateTags(supabase as never, "t1", ["tag-a"])).rejects.toBeTruthy();
  });
});

describe("getTemplate", () => {
  it("returns null (not throw) when not found or inaccessible", async () => {
    let call = 0;
    const supabase = {
      from: (table: string) => {
        call += 1;
        if (table === "transaction_templates") return fakeSupabaseTable(() => {}, { data: null, error: null });
        return fakeSupabaseTable(() => {}, { data: [], error: null });
      },
    };
    expect(await getTemplate(supabase as never, "t1")).toBeNull();
    expect(call).toBe(1); // never queries tags for a template that doesn't exist
  });

  it("maps a found row, resolving stale wallet/pocket/category flags and merging its tags", async () => {
    const row = {
      id: "t1",
      scope: "PERSONAL",
      owner_user_id: "user-a",
      household_id: null,
      transaction_type: "EXPENSE",
      name: "กาแฟตอนเช้า",
      amount: "60.00",
      title: "กาแฟ",
      note: null,
      archived_at: null,
      wallet_id: "w1",
      wallet: { name: "KBank", is_archived: true },
      pocket_id: "p1",
      pocket: { name: "ใช้จ่าย", is_archived: false },
      category_id: "cat-1",
      category: { name: "เครื่องดื่ม", archived_at: null },
    };
    const tagRows = [{ template_id: "t1", tag: { id: "tag-a", name: "งาน", archived_at: null } }];

    const supabase = {
      from: (table: string) => {
        if (table === "transaction_templates") return fakeSupabaseTable(() => {}, { data: row, error: null });
        return fakeSupabaseTable(() => {}, { data: tagRows, error: null });
      },
    };

    const result = await getTemplate(supabase as never, "t1");
    expect(result).toEqual({
      templateId: "t1",
      scope: "PERSONAL",
      ownerUserId: "user-a",
      householdId: null,
      transactionType: "EXPENSE",
      name: "กาแฟตอนเช้า",
      amount: "60.00",
      title: "กาแฟ",
      note: null,
      archivedAt: null,
      walletId: "w1",
      walletName: "KBank",
      walletArchived: true, // stale flag surfaced, never silently hidden
      pocketId: "p1",
      pocketName: "ใช้จ่าย",
      pocketArchived: false,
      categoryId: "cat-1",
      categoryName: "เครื่องดื่ม",
      categoryArchived: false,
      tags: [{ id: "tag-a", name: "งาน", archivedAt: null }],
    });
  });
});

describe("listTemplates", () => {
  it("batches tags for every returned template in one query, never one per template", async () => {
    const calls: unknown[] = [];
    const rows = [
      { id: "t1", scope: "PERSONAL", owner_user_id: "u", household_id: null, transaction_type: "EXPENSE", name: "A", amount: null, title: null, note: null, archived_at: null, wallet_id: null, wallet: null, pocket_id: null, pocket: null, category_id: null, category: null },
      { id: "t2", scope: "PERSONAL", owner_user_id: "u", household_id: null, transaction_type: "INCOME", name: "B", amount: null, title: null, note: null, archived_at: null, wallet_id: null, wallet: null, pocket_id: null, pocket: null, category_id: null, category: null },
    ];
    const supabase = {
      from: (table: string) => {
        calls.push(table);
        if (table === "transaction_templates") return fakeSupabaseTable(() => {}, { data: rows, error: null });
        return fakeSupabaseTable(() => {}, { data: [], error: null });
      },
    };

    const result = await listTemplates(supabase as never, { scope: "PERSONAL" });
    expect(result).toHaveLength(2);
    expect(calls.filter((t) => t === "transaction_template_tags")).toHaveLength(1);
  });

  it("returns an empty array on error rather than throwing (read model)", async () => {
    const supabase = { from: () => fakeSupabaseTable(() => {}, { data: null, error: { message: "boom" } }) };
    expect(await listTemplates(supabase as never, { scope: "PERSONAL" })).toEqual([]);
  });
});
