import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, MoneyScope } from "@/types/database";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";

import type { CreditCardAccount } from "./types";

type CardRow = {
  account_id: string;
  wallet_id: string;
  system_pocket_id: string;
  name: string;
  issuer: string | null;
  network: string | null;
  last_four: string | null;
  scope: MoneyScope;
  household_id: string | null;
  currency: string;
  credit_limit: string | number;
  wallet_balance: string | number;
  liability: string | number;
  card_credit: string | number;
  available_credit: string | number;
  statement_closing_day: number;
  payment_due_day: number;
  apr: string | number | null;
  is_archived: boolean;
};

const mapCard = (row: CardRow): CreditCardAccount => ({
  accountId: row.account_id,
  walletId: row.wallet_id,
  systemPocketId: row.system_pocket_id,
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
  apr: row.apr == null ? null : String(row.apr),
  isArchived: row.is_archived,
});

export async function listCreditCards(
  supabase: SupabaseClient<Database>,
  includeArchived = false,
): Promise<CreditCardAccount[]> {
  const { data, error } = await supabase.rpc("get_credit_card_accounts", {
    p_include_archived: includeArchived,
  });
  if (error) {
    logDatabaseErrorInDev("listCreditCards failed", error);
    return [];
  }
  return ((data ?? []) as unknown as CardRow[]).map(mapCard);
}

export async function loadCreditCards(
  supabase: SupabaseClient<Database>,
  includeArchived = false,
): Promise<{ status: "ok"; items: CreditCardAccount[] } | { status: "error" }> {
  const { data, error } = await supabase.rpc("get_credit_card_accounts", {
    p_include_archived: includeArchived,
  });
  if (error) {
    logDatabaseErrorInDev("loadCreditCards failed", error);
    return { status: "error" };
  }
  return {
    status: "ok",
    items: ((data ?? []) as unknown as CardRow[]).map(mapCard),
  };
}

export async function getCreditCard(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<CreditCardAccount | null> {
  return (
    (await listCreditCards(supabase, true)).find(
      (card) => card.accountId === accountId,
    ) ?? null
  );
}

export async function createCreditCard(
  supabase: SupabaseClient<Database>,
  params: {
    scope: MoneyScope;
    householdId: string | null;
    name: string;
    currency: string;
    issuer: string | null;
    network: string | null;
    lastFour: string | null;
    creditLimit: string;
    statementClosingDay: number;
    paymentDueDay: number;
    apr: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_credit_card_account", {
    p_scope: params.scope,
    p_household_id: params.householdId,
    p_name: params.name,
    p_currency: params.currency,
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

export async function updateCreditCard(
  supabase: SupabaseClient<Database>,
  accountId: string,
  params: Omit<
    Parameters<typeof createCreditCard>[1],
    "scope" | "householdId" | "currency"
  >,
): Promise<void> {
  const { error } = await supabase.rpc("update_credit_card_account", {
    p_account_id: accountId,
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
}
