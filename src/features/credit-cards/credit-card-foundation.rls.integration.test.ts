import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const env = process.env;
const configured = Boolean(
  env.SUPABASE_TEST_URL &&
    env.SUPABASE_TEST_ANON_KEY &&
    env.SUPABASE_TEST_SERVICE_ROLE_KEY &&
    env.SUPABASE_TEST_USER_A_EMAIL &&
    env.SUPABASE_TEST_USER_A_PASSWORD &&
    env.SUPABASE_TEST_USER_B_EMAIL &&
    env.SUPABASE_TEST_USER_B_PASSWORD &&
    env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL &&
    env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD &&
    env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL &&
    env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD &&
    env.SUPABASE_TEST_HOUSEHOLD_ID &&
    env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID,
);
const client = () => createClient(env.SUPABASE_TEST_URL!, env.SUPABASE_TEST_ANON_KEY!);
const admin = () => createClient(env.SUPABASE_TEST_URL!, env.SUPABASE_TEST_SERVICE_ROLE_KEY!);
async function signedIn(email: string, password: string) {
  const value = client();
  const { error } = await value.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return value;
}

describe.skipIf(!configured)("0054 credit-card account RLS", () => {
  async function cleanup(accountId: string) {
    const service = admin();
    const { data } = await service.from("credit_card_accounts").select("wallet_id, system_pocket_id").eq("id", accountId).single();
    if (!data) return;
    const { data: events } = await service.from("credit_card_liability_events").select("transaction_id").eq("card_account_id", accountId);
    const transactionIds = (events ?? []).map((event) => event.transaction_id);
    if (transactionIds.length) {
      await service.from("expense_adjustments").delete().in("transaction_id", transactionIds);
      await service.from("transaction_tags").delete().in("transaction_id", transactionIds);
      await service.from("credit_card_liability_events").delete().eq("card_account_id", accountId);
      await service.from("transaction_entries").delete().in("transaction_id", transactionIds);
      await service.from("transactions").delete().in("id", transactionIds);
    }
    await service.from("credit_card_accounts").delete().eq("id", accountId);
    await service.from("pockets").delete().eq("id", data.system_pocket_id);
    await service.from("wallets").delete().eq("id", data.wallet_id);
  }

  it("creates an owner-visible PERSONAL card, hides it from an outsider, and rejects generic posting", async () => {
    const owner = await signedIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: accountId, error } = await owner.rpc("create_credit_card_account", {
      p_scope:"PERSONAL", p_household_id:null, p_name:`Card ${Date.now()}`, p_currency:"THB", p_issuer:"Test",
      p_network:"VISA", p_last_four:"1234", p_credit_limit:"20000", p_statement_closing_day:31, p_payment_due_day:15, p_apr:"18",
    });
    expect(error).toBeNull();
    try {
      const { data: cards } = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      const card = cards?.find((row: { account_id:string }) => row.account_id === accountId);
      expect(card?.wallet_balance).toBe(0);
      expect(card?.available_credit).toBe(20000);
      const outsider = await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      expect((await outsider.from("credit_card_accounts").select("id").eq("id", accountId)).data).toEqual([]);
      expect((await owner.from("credit_card_accounts").update({ issuer:"Tampered" }).eq("id", accountId)).error).not.toBeNull();
      const { error: postingError } = await owner.rpc("create_income_expense_transaction", {
        p_transaction_type:"EXPENSE", p_wallet_id:card!.wallet_id, p_pocket_id:card!.system_pocket_id,
        p_category_id:env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!, p_amount:"1.00",
      });
      expect(postingError).not.toBeNull();
    } finally { await cleanup(accountId!); }
  });

  it("allows current household members to share a HOUSEHOLD card but hides it from non-members", async () => {
    const member = await signedIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { data: accountId, error } = await member.rpc("create_credit_card_account", {
      p_scope:"HOUSEHOLD", p_household_id:env.SUPABASE_TEST_HOUSEHOLD_ID!, p_name:`HH Card ${Date.now()}`,
      p_currency:"THB", p_issuer:null, p_network:null, p_last_four:null, p_credit_limit:"10000",
      p_statement_closing_day:28, p_payment_due_day:10, p_apr:null,
    });
    expect(error).toBeNull();
    try {
      const householdOwner = await signedIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
      expect((await householdOwner.from("credit_card_accounts").select("id").eq("id", accountId).single()).data?.id).toBe(accountId);
      const outsider = await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      expect((await outsider.from("credit_card_accounts").select("id").eq("id", accountId)).data).toEqual([]);
    } finally { await cleanup(accountId!); }
  });

  it("posts one purchase expense, returns a refund to the same card, and keeps events private", async () => {
    const owner = await signedIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: accountId, error } = await owner.rpc("create_credit_card_account", {
      p_scope:"PERSONAL", p_household_id:null, p_name:`Purchase card ${Date.now()}`, p_currency:"THB", p_issuer:null,
      p_network:null, p_last_four:null, p_credit_limit:"20000", p_statement_closing_day:31, p_payment_due_day:15, p_apr:null,
    });
    expect(error).toBeNull();
    try {
      const { data: purchaseId, error: purchaseError } = await owner.rpc("create_card_purchase", {
        p_card_account_id:accountId!, p_category_id:env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!, p_amount:"100.00",
        p_title:"Test purchase", p_note:null, p_occurred_at:new Date().toISOString(), p_tag_ids:null,
      });
      expect(purchaseError).toBeNull();
      const { data: refundId, error: refundError } = await owner.rpc("create_card_purchase_refund", {
        p_original_purchase_transaction_id:purchaseId!, p_amount:"25.00", p_title:"Test refund", p_note:null,
        p_occurred_at:new Date().toISOString(), p_tag_ids:null,
      });
      expect(refundError).toBeNull();
      const { data: cards } = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(75);
      const { data: events } = await owner.from("credit_card_liability_events").select("event_kind, amount").eq("card_account_id", accountId);
      expect(events?.map((event) => [event.event_kind, Number(event.amount)])).toEqual(expect.arrayContaining([["PURCHASE", 100], ["PURCHASE_REFUND", -25]]));
      const outsider = await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      expect((await outsider.from("credit_card_liability_events").select("id").eq("card_account_id", accountId)).data).toEqual([]);
      expect(refundId).toBeTruthy();
    } finally { await cleanup(accountId!); }
  });
});

const paymentConfigured = Boolean(
  configured &&
    env.SUPABASE_TEST_PERSONAL_WALLET_ID &&
    env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID,
);

describe.skipIf(!paymentConfigured)("0058 credit-card charges, allocation RLS and accounting", () => {
  it("expenses issuer charges once, allocates one transfer, and voids/restores all slices", async () => {
    const owner = await signedIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: accountId, error } = await owner.rpc("create_credit_card_account", {
      p_scope:"PERSONAL", p_household_id:null, p_name:`Payment card ${Date.now()}`, p_currency:"THB", p_issuer:null,
      p_network:null, p_last_four:null, p_credit_limit:"20000", p_statement_closing_day:31, p_payment_due_day:15, p_apr:null,
    });
    expect(error).toBeNull();
    try {
      const { data: purchaseId, error: purchaseError } = await owner.rpc("create_card_purchase", {
        p_card_account_id:accountId!, p_category_id:env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!, p_amount:"100.00",
        p_title:"Payment test purchase", p_note:null, p_occurred_at:new Date().toISOString(), p_tag_ids:null,
      });
      expect(purchaseError).toBeNull();
      expect(purchaseId).toBeTruthy();

      const chargeIds: string[] = [];
      for (const [kind, amount] of [["INTEREST", "25.00"], ["FEE", "10.00"], ["LATE_FEE", "5.00"]] as const) {
        const charge = await owner.rpc("create_credit_card_issuer_charge", {
          p_card_account_id:accountId!, p_charge_kind:kind, p_amount:amount,
          p_title:`${kind} test`, p_note:null, p_occurred_at:new Date().toISOString(),
        });
        expect(charge.error).toBeNull();
        chargeIds.push(charge.data!);
      }

      const beforeSource = await owner.rpc("get_wallet_balance", { p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
      const { data: paymentId, error: paymentError } = await owner.rpc("create_credit_card_payment", {
        p_card_account_id:accountId!, p_from_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_from_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"50.00",
        p_title:"Payment", p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(paymentError).toBeNull();
      expect(paymentId).toBeTruthy();

      const afterSource = await owner.rpc("get_wallet_balance", { p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
      expect(Number(afterSource.data) - Number(beforeSource.data)).toBe(-50);
      let cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(90);
      const components = await owner.rpc("get_credit_card_outstanding_components", { p_card_account_id:accountId! });
      expect(components.data?.[0]).toMatchObject({ principal:90, interest:0, fee:0, late_fee:0, total:90 });
      const allocations = await owner.from("credit_card_liability_events").select("event_kind, amount").eq("transaction_id", paymentId!);
      expect(allocations.data?.map((row) => [row.event_kind, Number(row.amount)])).toEqual(expect.arrayContaining([
        ["PAYMENT_LATE_FEE", -5], ["PAYMENT_FEE", -10], ["PAYMENT_INTEREST", -25], ["PAYMENT_PRINCIPAL", -10],
      ]));
      const { data: transactionKinds } = await owner.from("transactions").select("id, transaction_type").in("id", [...chargeIds, paymentId!]);
      expect(transactionKinds?.filter((row) => chargeIds.includes(row.id)).every((row) => row.transaction_type === "EXPENSE")).toBe(true);
      expect(transactionKinds?.find((row) => row.id === paymentId)?.transaction_type).toBe("TRANSFER");

      const overpay = await owner.rpc("create_credit_card_payment", {
        p_card_account_id:accountId!, p_from_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_from_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"91.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(overpay.error).not.toBeNull();

      const genericChargeRefund = await owner.rpc("create_expense_adjustment_transaction", {
        p_original_expense_id:chargeIds[0]!, p_adjustment_kind:"REFUND",
        p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"1.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(), p_tag_ids:null,
      });
      expect(genericChargeRefund.error).not.toBeNull();

      const paidChargeVoid = await owner.rpc("void_transaction", { p_transaction_id:chargeIds[0]!, p_void_reason:"test" });
      expect(paidChargeVoid.error).not.toBeNull();

      expect((await owner.rpc("void_transaction", { p_transaction_id:paymentId!, p_void_reason:"test" })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(140);
      expect((await owner.rpc("void_transaction", { p_transaction_id:chargeIds[0]!, p_void_reason:"test" })).error).toBeNull();
      expect((await owner.rpc("restore_transaction", { p_transaction_id:paymentId! })).error).not.toBeNull();
      expect((await owner.rpc("restore_transaction", { p_transaction_id:chargeIds[0]! })).error).toBeNull();
      expect((await owner.rpc("restore_transaction", { p_transaction_id:paymentId! })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(90);

      const outsider = await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      const unauthorized = await outsider.rpc("create_credit_card_payment", {
        p_card_account_id:accountId!, p_from_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_from_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"1.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(unauthorized.error).not.toBeNull();
      const unauthorizedCharge = await outsider.rpc("create_credit_card_issuer_charge", {
        p_card_account_id:accountId!, p_charge_kind:"FEE", p_amount:"1.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(unauthorizedCharge.error).not.toBeNull();
    } finally { await (async () => {
      const service = admin();
      const { data } = await service.from("credit_card_accounts").select("wallet_id, system_pocket_id").eq("id", accountId!).single();
      const { data: events } = await service.from("credit_card_liability_events").select("transaction_id").eq("card_account_id", accountId!);
      const ids = (events ?? []).map((event) => event.transaction_id);
      if (ids.length) {
        await service.from("expense_adjustments").delete().in("transaction_id", ids);
        await service.from("credit_card_liability_events").delete().eq("card_account_id", accountId!);
        await service.from("transaction_entries").delete().in("transaction_id", ids);
        await service.from("transactions").delete().in("id", ids);
      }
      await service.from("credit_card_accounts").delete().eq("id", accountId!);
      if (data) {
        await service.from("pockets").delete().eq("id", data.system_pocket_id);
        await service.from("wallets").delete().eq("id", data.wallet_id);
      }
    })(); }
  });
});

describe.skipIf(!configured)("0060 credit-card cashback RLS and accounting", () => {
  it("creates card credit without income and keeps cashback private", async () => {
    const owner = await signedIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: accountId, error } = await owner.rpc("create_credit_card_account", {
      p_scope:"PERSONAL", p_household_id:null, p_name:`Cashback card ${Date.now()}`, p_currency:"THB", p_issuer:null,
      p_network:null, p_last_four:null, p_credit_limit:"20000", p_statement_closing_day:31, p_payment_due_day:15, p_apr:null,
    });
    expect(error).toBeNull();
    try {
      const purchase = await owner.rpc("create_card_purchase", {
        p_card_account_id:accountId!, p_category_id:env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!, p_amount:"100.00",
        p_title:"Cashback purchase", p_note:null, p_occurred_at:new Date().toISOString(), p_tag_ids:null,
      });
      expect(purchase.error).toBeNull();

      const cashback = await owner.rpc("create_credit_card_cashback", {
        p_card_account_id:accountId!, p_amount:"125.00", p_title:"Cashback", p_note:null,
        p_occurred_at:new Date().toISOString(),
      });
      expect(cashback.error).toBeNull();

      let cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)).toMatchObject({
        wallet_balance:25, liability:0, card_credit:25,
      });
      const components = await owner.rpc("get_credit_card_outstanding_components", { p_card_account_id:accountId! });
      expect(components.data?.[0]).toMatchObject({
        principal:0, interest:0, fee:0, late_fee:0, unallocated_credit:25, total:0,
      });
      const transaction = await owner.from("transactions").select("transaction_type, category_id").eq("id", cashback.data!).single();
      expect(transaction.data).toEqual({ transaction_type:"CARD_ADJUSTMENT", category_id:null });
      const event = await owner.from("credit_card_liability_events").select("event_kind, amount").eq("transaction_id", cashback.data!).single();
      expect(event.data).toMatchObject({ event_kind:"CASHBACK", amount:-125 });

      const outsider = await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      expect((await outsider.from("credit_card_liability_events").select("id").eq("transaction_id", cashback.data!)).data).toEqual([]);
      expect((await outsider.rpc("create_credit_card_cashback", {
        p_card_account_id:accountId!, p_amount:"1.00", p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      })).error).not.toBeNull();
      expect((await owner.from("credit_card_liability_events").insert({
        card_account_id:accountId!, event_kind:"CASHBACK", amount:-1, transaction_id:cashback.data!, created_by:(await owner.auth.getUser()).data.user!.id,
      })).error).not.toBeNull();

      expect((await owner.rpc("void_transaction", { p_transaction_id:cashback.data!, p_void_reason:"test" })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(100);
      expect((await owner.rpc("restore_transaction", { p_transaction_id:cashback.data! })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.card_credit)).toBe(25);
    } finally { await (async () => {
      const service = admin();
      const { data } = await service.from("credit_card_accounts").select("wallet_id, system_pocket_id").eq("id", accountId!).single();
      const { data: events } = await service.from("credit_card_liability_events").select("transaction_id").eq("card_account_id", accountId!);
      const ids = (events ?? []).map((item) => item.transaction_id);
      if (ids.length) {
        await service.from("credit_card_liability_events").delete().eq("card_account_id", accountId!);
        await service.from("transaction_entries").delete().in("transaction_id", ids);
        await service.from("transactions").delete().in("id", ids);
      }
      await service.from("credit_card_accounts").delete().eq("id", accountId!);
      if (data) {
        await service.from("pockets").delete().eq("id", data.system_pocket_id);
        await service.from("wallets").delete().eq("id", data.wallet_id);
      }
    })(); }
  });
});

describe.skipIf(!paymentConfigured)("0061 credit-card cash-advance RLS and accounting", () => {
  it("moves cash without income/expense, enforces available credit, and voids/restores", async () => {
    const owner = await signedIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: accountId, error } = await owner.rpc("create_credit_card_account", {
      p_scope:"PERSONAL", p_household_id:null, p_name:`Cash advance card ${Date.now()}`, p_currency:"THB", p_issuer:null,
      p_network:null, p_last_four:null, p_credit_limit:"100", p_statement_closing_day:31, p_payment_due_day:15, p_apr:null,
    });
    expect(error).toBeNull();
    try {
      const beforeDestination = await owner.rpc("get_wallet_balance", {
        p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      });
      const advance = await owner.rpc("create_credit_card_cash_advance", {
        p_card_account_id:accountId!, p_to_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_to_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"80.00",
        p_title:"Cash advance", p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(advance.error).toBeNull();

      const afterDestination = await owner.rpc("get_wallet_balance", {
        p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      });
      expect(Number(afterDestination.data) - Number(beforeDestination.data)).toBe(80);
      let cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)).toMatchObject({
        wallet_balance:-80, liability:80, available_credit:20,
      });
      const components = await owner.rpc("get_credit_card_outstanding_components", { p_card_account_id:accountId! });
      expect(components.data?.[0]).toMatchObject({ principal:80, total:80 });
      const transaction = await owner.from("transactions").select("transaction_type, category_id").eq("id", advance.data!).single();
      expect(transaction.data).toEqual({ transaction_type:"TRANSFER", category_id:null });
      const event = await owner.from("credit_card_liability_events").select("event_kind, amount").eq("transaction_id", advance.data!).single();
      expect(event.data).toMatchObject({ event_kind:"CASH_ADVANCE", amount:80 });

      const overLimit = await owner.rpc("create_credit_card_cash_advance", {
        p_card_account_id:accountId!, p_to_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_to_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"21.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(overLimit.error).not.toBeNull();

      const outsider = await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      expect((await outsider.rpc("create_credit_card_cash_advance", {
        p_card_account_id:accountId!, p_to_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_to_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"1.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      })).error).not.toBeNull();
      expect((await outsider.from("credit_card_liability_events").select("id").eq("transaction_id", advance.data!)).data).toEqual([]);

      expect((await owner.rpc("void_transaction", { p_transaction_id:advance.data!, p_void_reason:"test" })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(0);
      expect((await owner.rpc("get_wallet_balance", { p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID! })).data).toBe(beforeDestination.data);

      expect((await owner.rpc("restore_transaction", { p_transaction_id:advance.data! })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(80);
    } finally { await (async () => {
      const service = admin();
      const { data } = await service.from("credit_card_accounts").select("wallet_id, system_pocket_id").eq("id", accountId!).single();
      const { data: events } = await service.from("credit_card_liability_events").select("transaction_id").eq("card_account_id", accountId!);
      const ids = (events ?? []).map((item) => item.transaction_id);
      if (ids.length) {
        await service.from("credit_card_liability_events").delete().eq("card_account_id", accountId!);
        await service.from("transaction_entries").delete().in("transaction_id", ids);
        await service.from("transactions").delete().in("id", ids);
      }
      await service.from("credit_card_accounts").delete().eq("id", accountId!);
      if (data) {
        await service.from("pockets").delete().eq("id", data.system_pocket_id);
        await service.from("wallets").delete().eq("id", data.wallet_id);
      }
    })(); }
  });
});

describe.skipIf(!configured)("0062 credit-card balance-adjustment RLS and accounting", () => {
  it("reconciles liability/card credit, stays private, and voids/restores", async () => {
    const owner=await signedIn(env.SUPABASE_TEST_USER_A_EMAIL!,env.SUPABASE_TEST_USER_A_PASSWORD!);
    const created=await owner.rpc("create_credit_card_account",{
      p_scope:"PERSONAL",p_household_id:null,p_name:`Adjustment card ${Date.now()}`,p_currency:"THB",p_issuer:null,
      p_network:null,p_last_four:null,p_credit_limit:"100",p_statement_closing_day:31,p_payment_due_day:15,p_apr:null,
    });
    expect(created.error).toBeNull(); const accountId=created.data!;
    try {
      const liability=await owner.rpc("create_credit_card_balance_adjustment",{
        p_card_account_id:accountId,p_target_wallet_balance:"-120",p_note:"issuer",p_occurred_at:new Date().toISOString(),
      });
      expect(liability.error).toBeNull();
      const credit=await owner.rpc("create_credit_card_balance_adjustment",{
        p_card_account_id:accountId,p_target_wallet_balance:"20",p_note:"issuer correction",p_occurred_at:new Date().toISOString(),
      });
      expect(credit.error).toBeNull();
      let cards=await owner.rpc("get_credit_card_accounts",{p_include_archived:true});
      expect(cards.data?.find((card:{account_id:string})=>card.account_id===accountId)).toMatchObject({wallet_balance:20,liability:0,card_credit:20});
      const components=await owner.rpc("get_credit_card_outstanding_components",{p_card_account_id:accountId});
      expect(components.data?.[0]).toMatchObject({total:0,unallocated_credit:20});
      expect((await owner.from("transactions").select("transaction_type,category_id").eq("id",credit.data!).single()).data)
        .toEqual({transaction_type:"CARD_ADJUSTMENT",category_id:null});
      expect((await owner.from("credit_card_liability_events").select("event_kind,amount").eq("transaction_id",credit.data!).single()).data)
        .toMatchObject({event_kind:"BALANCE_ADJUSTMENT",amount:-140});
      const outsider=await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!,env.SUPABASE_TEST_USER_B_PASSWORD!);
      expect((await outsider.rpc("create_credit_card_balance_adjustment",{
        p_card_account_id:accountId,p_target_wallet_balance:"0",p_note:null,p_occurred_at:new Date().toISOString(),
      })).error).not.toBeNull();
      expect((await outsider.from("credit_card_liability_events").select("id").eq("transaction_id",credit.data!)).data).toEqual([]);
      expect((await owner.rpc("void_transaction",{p_transaction_id:credit.data!,p_void_reason:"test"})).error).toBeNull();
      cards=await owner.rpc("get_credit_card_accounts",{p_include_archived:true});
      expect(Number(cards.data?.find((card:{account_id:string})=>card.account_id===accountId)?.liability)).toBe(120);
      expect((await owner.rpc("restore_transaction",{p_transaction_id:credit.data!})).error).toBeNull();
    } finally {
      const service=admin();
      const {data}=await service.from("credit_card_accounts").select("wallet_id,system_pocket_id").eq("id",accountId).single();
      const {data:events}=await service.from("credit_card_liability_events").select("transaction_id").eq("card_account_id",accountId);
      const ids=(events??[]).map((event)=>event.transaction_id);
      if(ids.length){await service.from("credit_card_liability_events").delete().eq("card_account_id",accountId);await service.from("transaction_entries").delete().in("transaction_id",ids);await service.from("transactions").delete().in("id",ids);}
      await service.from("credit_card_accounts").delete().eq("id",accountId);
      if(data){await service.from("pockets").delete().eq("id",data.system_pocket_id);await service.from("wallets").delete().eq("id",data.wallet_id);}
    }
  });
});

describe.skipIf(!paymentConfigured)("0063 immutable card statements, allocations and RLS",()=>{
  it("derives payment and credit allocations while preserving the statement snapshot",async()=>{
    const owner=await signedIn(env.SUPABASE_TEST_USER_A_EMAIL!,env.SUPABASE_TEST_USER_A_PASSWORD!);
    const now=new Date();const closeDay=28;let periodEnd=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),closeDay));
    if(periodEnd>=now)periodEnd=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,closeDay));
    const priorClose=new Date(Date.UTC(periodEnd.getUTCFullYear(),periodEnd.getUTCMonth()-1,closeDay));
    const periodStart=new Date(priorClose);periodStart.setUTCDate(periodStart.getUTCDate()+1);
    const dueDate=new Date(Date.UTC(periodEnd.getUTCFullYear(),periodEnd.getUTCMonth()+1,15));
    const isoDate=(date:Date)=>date.toISOString().slice(0,10);
    const created=await owner.rpc("create_credit_card_account",{
      p_scope:"PERSONAL",p_household_id:null,p_name:`Statement card ${Date.now()}`,p_currency:"THB",p_issuer:null,
      p_network:null,p_last_four:null,p_credit_limit:"20000",p_statement_closing_day:closeDay,p_payment_due_day:15,p_apr:null,
    });
    expect(created.error).toBeNull();const accountId=created.data!;
    try{
      const purchase=await owner.rpc("create_card_purchase",{
        p_card_account_id:accountId,p_category_id:env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,p_amount:"100.00",
        p_title:"Statement purchase",p_note:null,p_occurred_at:`${isoDate(periodStart)}T05:00:00.000Z`,p_tag_ids:null,
      });
      expect(purchase.error).toBeNull();
      const issued=await owner.rpc("issue_credit_card_statement",{
        p_card_account_id:accountId,p_period_start:isoDate(periodStart),p_period_end:isoDate(periodEnd),
        p_due_date:isoDate(dueDate),p_minimum_amount_due:"20.00",
      });
      expect(issued.error).toBeNull();const statementId=issued.data!;
      const payment=await owner.rpc("create_credit_card_payment",{
        p_card_account_id:accountId,p_from_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_from_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,p_amount:"30.00",p_title:"Statement payment",
        p_note:null,p_occurred_at:new Date().toISOString(),
      });
      expect(payment.error).toBeNull();
      const cashback=await owner.rpc("create_credit_card_cashback",{
        p_card_account_id:accountId,p_amount:"10.00",p_title:"Statement credit",p_note:null,p_occurred_at:new Date().toISOString(),
      });
      expect(cashback.error).toBeNull();
      let statements=await owner.rpc("get_credit_card_statements",{p_card_account_id:accountId});
      expect(statements.data?.find((row:{statement_id:string})=>row.statement_id===statementId)).toMatchObject({
        statement_balance:100,paid_to_date:30,credits_to_date:10,effective_amount_due:60,status:"PARTIALLY_PAID",minimum_payment_met:true,
      });
      expect((await owner.rpc("void_transaction",{p_transaction_id:payment.data!,p_void_reason:"statement test"})).error).toBeNull();
      statements=await owner.rpc("get_credit_card_statements",{p_card_account_id:accountId});
      expect(statements.data?.[0]).toMatchObject({statement_balance:100,paid_to_date:0,credits_to_date:10,effective_amount_due:90,minimum_payment_met:false});
      expect((await owner.rpc("restore_transaction",{p_transaction_id:payment.data!})).error).toBeNull();
      const outsider=await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!,env.SUPABASE_TEST_USER_B_PASSWORD!);
      expect((await outsider.from("credit_card_statements").select("id").eq("id",statementId)).data).toEqual([]);
      expect((await outsider.from("credit_card_statement_allocations").select("id").eq("statement_id",statementId)).data).toEqual([]);
      expect((await owner.from("credit_card_statements").update({minimum_amount_due:1}).eq("id",statementId)).error).not.toBeNull();
      expect((await owner.from("credit_card_statement_allocations").insert({
        statement_id:statementId,liability_event_id:"00000000-0000-0000-0000-000000000000",allocation_kind:"PAYMENT",amount:1,
      })).error).not.toBeNull();
    }finally{
      const service=admin();const {data}=await service.from("credit_card_accounts").select("wallet_id,system_pocket_id").eq("id",accountId).single();
      const {data:events}=await service.from("credit_card_liability_events").select("transaction_id").eq("card_account_id",accountId);
      const ids=(events??[]).map((event)=>event.transaction_id);
      await service.from("credit_card_statement_allocations").delete().in("statement_id",(await service.from("credit_card_statements").select("id").eq("card_account_id",accountId)).data?.map((row)=>row.id)??[]);
      await service.from("credit_card_statements").delete().eq("card_account_id",accountId);
      if(ids.length){await service.from("credit_card_liability_events").delete().eq("card_account_id",accountId);await service.from("transaction_entries").delete().in("transaction_id",ids);await service.from("transactions").delete().in("id",ids);}
      await service.from("credit_card_accounts").delete().eq("id",accountId);
      if(data){await service.from("pockets").delete().eq("id",data.system_pocket_id);await service.from("wallets").delete().eq("id",data.wallet_id);}
    }
  });
});
