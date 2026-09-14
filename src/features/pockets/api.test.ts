import { describe, expect, it } from "vitest";

import {
  archivePocket,
  createCreditCardPocket,
  createPocket,
  createPocketWithInitialBalance,
  deletePocket,
  listPocketsWithBalances,
  restorePocket,
  updatePocket,
} from "./api";
import type { Pocket } from "./types";

function fakeTable(
  onCall: (method: string, args: unknown[]) => void,
  resolved: { data: unknown; error: unknown },
) {
  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      onCall(method, args);
      return builder;
    };
  builder.update = chain("update");
  builder.delete = chain("delete");
  builder.eq = chain("eq");
  builder.select = chain("select");
  builder.single = () => Promise.resolve(resolved);
  builder.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    resolve(resolved);
  return builder;
}

const walletId = "11111111-1111-4111-8111-111111111111";

function pocket(overrides: Partial<Pocket>): Pocket {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    wallet_id: walletId,
    name: "Everyday",
    pocket_type: "CASH",
    currency: "THB",
    icon: null,
    sort_order: 0,
    is_archived: false,
    created_at: "2026-09-08T00:00:00Z",
    updated_at: "2026-09-08T00:00:00Z",
    ...overrides,
  };
}

describe("createPocket", () => {
  it("creates one ordinary pocket under the supplied wallet without ledger writes", async () => {
    const calls: string[] = [];
    let inserted: Record<string, unknown> | undefined;
    const created = pocket({ name: "Food" });
    const supabase = {
      from(table: string) {
        calls.push(`from:${table}`);
        return {
          insert(value: Record<string, unknown>) {
            inserted = value;
            return {
              select: () => ({
                single: async () => ({ data: created, error: null }),
              }),
            };
          },
        };
      },
    };

    const result = await createPocket(supabase as never, {
      walletId,
      name: "Food",
    });

    // No is_default field anywhere — every pocket is created equal.
    expect(inserted).toEqual({
      wallet_id: walletId,
      name: "Food",
      sort_order: 0,
    });
    expect(result).not.toHaveProperty("is_default");
    expect(calls).toEqual(["from:pockets"]);
  });
});

describe("Pocket-owned account settings", () => {
  it("creates a regular Pocket with its own currency and opening balance", async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: "usd-pocket", error: null };
      },
    };

    await expect(
      createPocketWithInitialBalance(supabase as never, {
        walletId,
        name: "Travel USD",
        pocketType: "BANK",
        currency: "USD",
        initialBalance: "250.00",
      }),
    ).resolves.toBe("usd-pocket");

    expect(calls).toEqual([
      {
        fn: "create_pocket_with_initial_balance",
        args: {
          p_wallet_id: walletId,
          p_name: "Travel USD",
          p_pocket_type: "BANK",
          p_currency: "USD",
          p_initial_balance: "250.00",
        },
      },
    ]);
  });

  it("creates a credit card as a Pocket inside an existing Wallet", async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: "card-pocket", error: null };
      },
    };

    await expect(
      createCreditCardPocket(supabase as never, {
        walletId,
        name: "KTC USD",
        currency: "USD",
        creditLimit: "10000.00",
        availableCredit: "7250.00",
        statementClosingDay: 25,
        paymentDueDay: 10,
      }),
    ).resolves.toBe("card-pocket");

    expect(calls).toEqual([
      {
        fn: "create_credit_card_pocket_with_available_credit",
        args: {
          p_wallet_id: walletId,
          p_name: "KTC USD",
          p_currency: "USD",
          p_credit_limit: "10000.00",
          p_available_credit: "7250.00",
          p_statement_closing_day: 25,
          p_payment_due_day: 10,
        },
      },
    ]);
  });
});

describe("listPocketsWithBalances", () => {
  it("gives every pocket its own derived balance with no special-cased pocket", async () => {
    const everyday = pocket({});
    const food = pocket({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Food",
    });
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      order: async () => ({ data: [everyday, food], error: null }),
    };
    const supabase = {
      from: () => query,
      rpc: async (_name: string, args: { p_pocket_id: string }) => ({
        data: args.p_pocket_id === food.id ? 0 : "75.00",
        error: null,
      }),
    };

    const result = await listPocketsWithBalances(supabase as never, walletId);

    // A newly-created pocket derives a zero balance from the ledger, same
    // as any other pocket with no entries — nothing about it is special.
    expect(result.find((item) => item.id === food.id)?.balance).toBe("0.00");
    expect(result.find((item) => item.id === everyday.id)?.balance).toBe(
      "75.00",
    );
    expect(result.every((item) => !("is_default" in item))).toBe(true);
  });
});

describe("updatePocket", () => {
  it("renames only the intended Pocket inside its actual Wallet", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const supabase = {
      from: () =>
        fakeTable((m, a) => calls.push({ method: m, args: a }), {
          data: { id: "p1" },
          error: null,
        }),
    };

    await updatePocket(supabase as never, "p1", walletId, { name: "Renamed" });

    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({
      name: "Renamed",
    });
    expect(calls.filter((c) => c.method === "eq")).toEqual([
      { method: "eq", args: ["id", "p1"] },
      { method: "eq", args: ["wallet_id", walletId] },
    ]);
    expect(calls).toContainEqual({ method: "select", args: ["id"] });
  });

  it("treats an RLS-filtered or wallet-mismatched zero-row update as failure", async () => {
    const noRows = {
      from: () =>
        fakeTable(() => {}, {
          data: null,
          error: { code: "PGRST116", message: "0 rows" },
        }),
    };
    await expect(
      updatePocket(noRows as never, "p1", "wrong-wallet", { name: "Renamed" }),
    ).rejects.toMatchObject({
      code: "PGRST116",
    });
  });

  it("rejects an unexpected returned row instead of reporting false success", async () => {
    const wrongRow = {
      from: () => fakeTable(() => {}, { data: { id: "p2" }, error: null }),
    };
    await expect(
      updatePocket(wrongRow as never, "p1", walletId, { name: "Renamed" }),
    ).rejects.toThrow("Pocket update did not return the intended row");
  });
});

describe("archivePocket / restorePocket / deletePocket", () => {
  it("archive surfaces DB rejection (last active pocket) instead of swallowing it", async () => {
    const rejecting = {
      from: () =>
        fakeTable(() => {}, {
          data: null,
          error: { message: "must keep at least one active pocket" },
        }),
    };
    await expect(archivePocket(rejecting as never, "p1")).rejects.toBeTruthy();
  });

  it("restore issues an is_archived=false update", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const supabase = {
      from: () =>
        fakeTable((m, a) => calls.push({ method: m, args: a }), {
          data: null,
          error: null,
        }),
    };
    await restorePocket(supabase as never, "p1");
    expect(calls).toContainEqual({
      method: "update",
      args: [{ is_archived: false }],
    });
  });

  it("delete surfaces DB rejection (has history, or last pocket) instead of swallowing it", async () => {
    const rejecting = {
      from: () =>
        fakeTable(() => {}, {
          data: null,
          error: { message: "has transaction history" },
        }),
    };
    await expect(deletePocket(rejecting as never, "p1")).rejects.toBeTruthy();

    const calls: Array<{ method: string; args: unknown[] }> = [];
    const accepting = {
      from: () =>
        fakeTable((m, a) => calls.push({ method: m, args: a }), {
          data: null,
          error: null,
        }),
    };
    await deletePocket(accepting as never, "p1");
    expect(calls.some((c) => c.method === "delete")).toBe(true);
  });
});
