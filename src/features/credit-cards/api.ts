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
    issuer: row.issuer,
    network: row.network,
    lastFour: row.last_four,
    scope: row.scope,
    householdId: row.household_id,
    currency: row.currency,
    creditLimit: normalizeDatabaseMoney(row.credit_limit),
    walletBalance: normalizeDatabaseMoney(row.wallet_balance),
    liability: normalizeDatabaseMoney(row.liability),
    cardCredit: normalizeDatabaseMoney(row.card_credit),
    availableCredit: normalizeDatabaseMoney(row.available_credit),
    statementClosingDay: row.statement_closing_day,
    paymentDueDay: row.payment_due_day,
    apr: row.apr === null ? null : normalizeDatabaseMoney(row.apr),
    archived: row.is_archived,
  }));
}

export async function updateCreditCardAccount(
  supabase: SupabaseClient<Database>,
  params: {
    accountId: string;
    name: string;
    issuer: string | null;
    network: string | null;
    lastFour: string | null;
    creditLimit: string;
    statementClosingDay: number;
    paymentDueDay: number;
    apr: string | null;
  },
) {
  const { data, error } = await supabase.rpc("update_credit_card_account", {
    p_account_id: params.accountId,
    p_name: params.name,
    p_issuer: params.issuer,
    p_network: params.network,
    p_last_four: params.lastFour,
    p_credit_limit: params.creditLimit,
    p_statement_closing_day: params.statementClosingDay,
    p_payment_due_day: params.paymentDueDay,
    p_apr: params.apr,
  });
  if (error) throw error;
  return data;
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
