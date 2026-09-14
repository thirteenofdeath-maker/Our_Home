import { describe, expect, it } from "vitest";

import {
  archiveWallet,
  createCreditCardWallet,
  createWallet,
  createWalletWithInitialBalance,
  deleteWallet,
  restoreWallet,
  updateWallet,
} from "./api";

function fakeSupabaseTable(
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
  builder.single = async () => resolved;
  // `await query` resolves the whole chain when no .select()/.single() is
  // ever called (update/delete without .select()) — mirrors supabase-js's
  // thenable query builder.
  builder.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    resolve(resolved);
  return builder;
}

describe("createWallet", () => {
  it("calls create_wallet_with_first_pocket with no created_by parameter (derived server-side from auth.uid())", async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: { id: "w1" }, error: null };
      },
    };

    await createWallet(supabase as never, {
      name: "SCB",
      walletType: "BANK",
      currency: "THB",
      scope: "PERSONAL",
      ownerUserId: "user-a",
      householdId: null,
      firstPocketName: "ใช้จ่าย",
    });

    expect(calls).toEqual([
      {
        fn: "create_wallet_with_first_pocket",
        args: {
          p_scope: "PERSONAL",
          p_owner_user_id: "user-a",
          p_household_id: null,
          p_name: "SCB",
          p_wallet_type: "BANK",
          p_currency: "THB",
          p_first_pocket_name: "ใช้จ่าย",
        },
      },
    ]);
  });

  it("creates a regular wallet with a ledger-backed opening balance", async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: "wallet-opening", error: null };
      },
    };

    await expect(
      createWalletWithInitialBalance(supabase as never, {
        name: "Cash Box",
        walletType: "CASH",
        currency: "THB",
        scope: "PERSONAL",
        ownerUserId: "user-a",
        householdId: null,
        firstPocketName: "Main",
        initialBalance: "1250.00",
      }),
    ).resolves.toBe("wallet-opening");

    expect(calls).toEqual([
      {
        fn: "create_wallet_with_initial_balance",
        args: {
          p_scope: "PERSONAL",
          p_owner_user_id: "user-a",
          p_household_id: null,
          p_name: "Cash Box",
          p_wallet_type: "CASH",
          p_currency: "THB",
          p_first_pocket_name: "Main",
          p_initial_balance: "1250.00",
        },
      },
    ]);
  });

  it("creates a credit card through the dedicated card account RPC", async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: "card-wallet", error: null };
      },
    };

    await expect(
      createCreditCardWallet(supabase as never, {
        name: "KTC",
        currency: "THB",
        scope: "PERSONAL",
        householdId: null,
        creditLimit: "50000.00",
        availableCredit: "42000.00",
        statementClosingDay: 25,
        paymentDueDay: 10,
      }),
    ).resolves.toBe("card-wallet");

    expect(calls).toEqual([
      {
        fn: "create_credit_card_account_with_available_credit",
        args: {
          p_scope: "PERSONAL",
          p_household_id: null,
          p_name: "KTC",
          p_currency: "THB",
          p_credit_limit: "50000.00",
          p_available_credit: "42000.00",
          p_statement_closing_day: 25,
          p_payment_due_day: 10,
        },
      },
    ]);
  });
});

describe("updateWallet", () => {
  it("sends only name/walletType/icon/currency — the database decides whether currency may actually change", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const supabase = {
      from: (table: string) => {
        calls.push({ method: "from", args: [table] });
        return fakeSupabaseTable(
          (method, args) => calls.push({ method, args }),
          { data: null, error: null },
        );
      },
    };

    await updateWallet(supabase as never, "w1", {
      name: "New Name",
      walletType: "CASH",
      currency: "USD",
    });

    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({
      name: "New Name",
      wallet_type: "CASH",
      icon: undefined,
      currency: "USD",
    });
  });

  it("throws (does not swallow) when the database rejects the update", async () => {
    const supabase = {
      from: () =>
        fakeSupabaseTable(() => {}, {
          data: null,
          error: { message: "currency is frozen", code: "23514" },
        }),
    };

    await expect(
      updateWallet(supabase as never, "w1", { currency: "USD" }),
    ).rejects.toBeTruthy();
  });
});

describe("archiveWallet / restoreWallet / deleteWallet", () => {
  it("archive issues an is_archived=true update and surfaces DB rejection (non-zero balance)", async () => {
    const rejecting = {
      from: () =>
        fakeSupabaseTable(() => {}, {
          data: null,
          error: { message: "non-zero balance" },
        }),
    };
    await expect(archiveWallet(rejecting as never, "w1")).rejects.toBeTruthy();

    const calls: unknown[] = [];
    const accepting = {
      from: () =>
        fakeSupabaseTable((m, a) => calls.push({ m, a }), {
          data: null,
          error: null,
        }),
    };
    await archiveWallet(accepting as never, "w1");
    expect(calls).toContainEqual({ m: "update", a: [{ is_archived: true }] });
  });

  it("restore issues an is_archived=false update", async () => {
    const calls: unknown[] = [];
    const supabase = {
      from: () =>
        fakeSupabaseTable((m, a) => calls.push({ m, a }), {
          data: null,
          error: null,
        }),
    };
    await restoreWallet(supabase as never, "w1");
    expect(calls).toContainEqual({ m: "update", a: [{ is_archived: false }] });
  });

  it("delete issues a real DELETE and surfaces DB rejection (has history)", async () => {
    const rejecting = {
      from: () =>
        fakeSupabaseTable(() => {}, {
          data: null,
          error: { message: "has history" },
        }),
    };
    await expect(deleteWallet(rejecting as never, "w1")).rejects.toBeTruthy();

    const calls: unknown[] = [];
    const accepting = {
      from: () =>
        fakeSupabaseTable((m, a) => calls.push({ m, a }), {
          data: null,
          error: null,
        }),
    };
    await deleteWallet(accepting as never, "w1");
    expect(calls.some((c) => (c as { m: string }).m === "delete")).toBe(true);
  });
});
