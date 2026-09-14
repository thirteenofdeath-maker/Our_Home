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

describe.skipIf(!paymentConfigured)("0057 credit-card payment RLS and accounting", () => {
  it("pays principal as a transfer, rejects overpayment, and voids/restores without expense", async () => {
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

      const beforeSource = await owner.rpc("get_wallet_balance", { p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
      const { data: paymentId, error: paymentError } = await owner.rpc("create_credit_card_payment", {
        p_card_account_id:accountId!, p_from_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_from_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"40.00",
        p_title:"Payment", p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(paymentError).toBeNull();
      expect(paymentId).toBeTruthy();

      const afterSource = await owner.rpc("get_wallet_balance", { p_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
      expect(Number(afterSource.data) - Number(beforeSource.data)).toBe(-40);
      let cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(60);

      const overpay = await owner.rpc("create_credit_card_payment", {
        p_card_account_id:accountId!, p_from_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_from_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"61.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(overpay.error).not.toBeNull();

      expect((await owner.rpc("void_transaction", { p_transaction_id:paymentId!, p_void_reason:"test" })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(100);
      expect((await owner.rpc("restore_transaction", { p_transaction_id:paymentId! })).error).toBeNull();
      cards = await owner.rpc("get_credit_card_accounts", { p_include_archived:true });
      expect(Number(cards.data?.find((card: { account_id:string }) => card.account_id === accountId)?.liability)).toBe(60);

      const outsider = await signedIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      const unauthorized = await outsider.rpc("create_credit_card_payment", {
        p_card_account_id:accountId!, p_from_wallet_id:env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
        p_from_pocket_id:env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, p_amount:"1.00",
        p_title:null, p_note:null, p_occurred_at:new Date().toISOString(),
      });
      expect(unauthorized.error).not.toBeNull();
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
