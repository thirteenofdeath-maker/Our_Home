import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { normalizeDatabaseMoney } from "@/lib/utils/money";

import type { CreditCardAccountOption } from "./types";

export async function listCreditCardAccounts(
  supabase: SupabaseClient<Database>,
  options: { includeArchived?: boolean } = {},
): Promise<CreditCardAccountOption[]> {
  const { data, error } = await supabase.rpc("get_credit_card_accounts", {
    p_include_archived: options.includeArchived ?? false,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    accountId: row.account_id,
    walletId: row.wallet_id,
    pocketId: row.system_pocket_id,
    name: row.name,
    scope: row.scope,
    householdId: row.household_id,
    currency: row.currency,
    creditLimit: normalizeDatabaseMoney(row.credit_limit),
    walletBalance: normalizeDatabaseMoney(row.wallet_balance),
    liability: normalizeDatabaseMoney(row.liability),
    cardCredit: normalizeDatabaseMoney(row.card_credit),
    availableCredit: normalizeDatabaseMoney(row.available_credit),
    archived: row.is_archived,
  }));
}

export async function createCreditCardPayment(
  supabase: SupabaseClient<Database>,
  params: {
    cardAccountId: string;
    fromWalletId: string;
    fromPocketId: string;
    amount: string;
    note: string | null;
    occurredAt: string;
  },
) {
  const { data, error } = await supabase.rpc("create_credit_card_payment", {
    p_card_account_id: params.cardAccountId,
    p_from_wallet_id: params.fromWalletId,
    p_from_pocket_id: params.fromPocketId,
    p_amount: params.amount,
    p_title: "ชำระบัตรเครดิต",
    p_note: params.note,
    p_occurred_at: params.occurredAt,
  });
  if (error) throw error;
  return data;
}

export async function createCreditCardCashback(
  supabase: SupabaseClient<Database>,
  params: {
    cardAccountId: string;
    amount: string;
    note: string | null;
    occurredAt: string;
  },
) {
  const { data, error } = await supabase.rpc("create_credit_card_cashback", {
    p_card_account_id: params.cardAccountId,
    p_amount: params.amount,
    p_title: "Cashback",
    p_note: params.note,
    p_occurred_at: params.occurredAt,
  });
  if (error) throw error;
  return data;
}

export async function createCreditCardCashAdvance(
  supabase: SupabaseClient<Database>,
  params: {
    cardAccountId: string;
    toWalletId: string;
    toPocketId: string;
    amount: string;
    note: string | null;
    occurredAt: string;
  },
) {
  const { data, error } = await supabase.rpc(
    "create_credit_card_cash_advance",
    {
      p_card_account_id: params.cardAccountId,
      p_to_wallet_id: params.toWalletId,
      p_to_pocket_id: params.toPocketId,
      p_amount: params.amount,
      p_title: "กดเงินสดจากบัตรเครดิต",
      p_note: params.note,
      p_occurred_at: params.occurredAt,
    },
  );
  if (error) throw error;
  return data;
}
