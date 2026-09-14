import { describe, expect, it } from "vitest";

import {
  createCreditCardCashAdvance,
  createCreditCardCashback,
  createCreditCardPayment,
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
});
