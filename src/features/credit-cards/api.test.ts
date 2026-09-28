import { describe, expect, it } from "vitest";

import {
  createCreditCardCashAdvance,
  createCreditCardCashback,
  createCreditCardPayment,
  listCreditCardAccounts,
  updateCreditCardAccount,
} from "./api";

function rpcRecorder() {
  const calls: Array<{ fn: string; args: unknown }> = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: "transaction-id", error: null };
      },
    },
  };
}

const common = {
  cardAccountId: "11111111-1111-4111-8111-111111111111",
  amount: "250.00",
  note: null,
  occurredAt: "2026-09-15T05:00:00.000Z",
};

describe("credit-card transaction API", () => {
  it("calls the dedicated payment RPC", async () => {
    const { client, calls } = rpcRecorder();
    await createCreditCardPayment(client as never, {
      ...common,
      fromWalletId: "22222222-2222-4222-8222-222222222222",
      fromPocketId: "33333333-3333-4333-8333-333333333333",
    });
    expect(calls[0]?.fn).toBe("create_credit_card_payment");
  });

  it("calls the dedicated cashback RPC", async () => {
    const { client, calls } = rpcRecorder();
    await createCreditCardCashback(client as never, common);
    expect(calls[0]?.fn).toBe("create_credit_card_cashback");
  });

  it("calls the dedicated cash-advance RPC", async () => {
    const { client, calls } = rpcRecorder();
    await createCreditCardCashAdvance(client as never, {
      ...common,
      toWalletId: "22222222-2222-4222-8222-222222222222",
      toPocketId: "33333333-3333-4333-8333-333333333333",
    });
    expect(calls[0]?.fn).toBe("create_credit_card_cash_advance");
  });

  it("updates cycle days through the guarded credit-card RPC", async () => {
    const { client, calls } = rpcRecorder();
    await updateCreditCardAccount(client as never, {
      accountId: common.cardAccountId,
      name: "KTC",
      issuer: "KTC",
      network: "VISA",
      lastFour: "1234",
      creditLimit: "50000.00",
      statementClosingDay: 25,
      paymentDueDay: 10,
      apr: "16.00",
    });
    expect(calls[0]).toEqual({
      fn: "update_credit_card_account",
      args: {
        p_account_id: common.cardAccountId,
        p_name: "KTC",
        p_issuer: "KTC",
        p_network: "VISA",
        p_last_four: "1234",
        p_credit_limit: "50000.00",
        p_statement_closing_day: 25,
        p_payment_due_day: 10,
        p_apr: "16.00",
      },
    });
  });

  it("returns editable cycle details when listing cards", async () => {
    const client = {
      rpc: async () => ({
        data: [
          {
            account_id: common.cardAccountId,
            wallet_id: "22222222-2222-4222-8222-222222222222",
            system_pocket_id: "33333333-3333-4333-8333-333333333333",
            name: "KTC",
            issuer: "KTC",
            network: "VISA",
            last_four: "1234",
            scope: "PERSONAL",
            household_id: null,
            currency: "THB",
            credit_limit: 50000,
            wallet_balance: -1200,
            liability: 1200,
            card_credit: 0,
            available_credit: 48800,
            statement_closing_day: 25,
            payment_due_day: 10,
            apr: 16,
            is_archived: false,
          },
        ],
        error: null,
      }),
    };

    const [card] = await listCreditCardAccounts(client as never);
    expect(card).toMatchObject({
      issuer: "KTC",
      network: "VISA",
      lastFour: "1234",
      statementClosingDay: 25,
      paymentDueDay: 10,
      apr: "16.00",
    });
  });
});
