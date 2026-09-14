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
});
