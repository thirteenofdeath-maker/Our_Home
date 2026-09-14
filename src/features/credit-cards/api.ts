import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, MoneyScope } from "@/types/database";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";

import type { CreditCardAccount, CreditCardActivityItem, CreditCardEventKind, CreditCardOutstandingComponents } from "./types";

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

export async function createCardPurchase(
  supabase: SupabaseClient<Database>,
  params: {
    cardAccountId: string;
    categoryId: string;
    amount: string;
    title: string | null;
    note: string | null;
    occurredAt: string;
    tagIds: string[];
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_card_purchase", {
    p_card_account_id: params.cardAccountId,
    p_category_id: params.categoryId,
    p_amount: params.amount,
    p_title: params.title,
    p_note: params.note,
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds.length ? params.tagIds : null,
  });
  if (error) throw error;
  return data;
}

export async function createAttributedCardPurchase(
  supabase: SupabaseClient<Database>,
  params: {
    cardAccountId: string;
    householdId: string;
    householdCategoryId: string;
    amount: string;
    title: string | null;
    note: string | null;
    occurredAt: string;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_attributed_card_purchase", {
    p_card_account_id: params.cardAccountId,
    p_household_id: params.householdId,
    p_household_category_id: params.householdCategoryId,
    p_amount: params.amount,
    p_title: params.title,
    p_note: params.note,
    p_occurred_at: params.occurredAt,
  });
  if (error) throw error;
  return data;
}

export async function createCardPurchaseRefund(
  supabase: SupabaseClient<Database>,
  params: {
    originalPurchaseTransactionId: string;
    amount: string;
    title: string | null;
    note: string | null;
    occurredAt: string;
    tagIds: string[];
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_card_purchase_refund", {
    p_original_purchase_transaction_id: params.originalPurchaseTransactionId,
    p_amount: params.amount,
    p_title: params.title,
    p_note: params.note,
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds.length ? params.tagIds : null,
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
    title: string | null;
    note: string | null;
    occurredAt: string;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_credit_card_payment", {
    p_card_account_id: params.cardAccountId,
    p_from_wallet_id: params.fromWalletId,
    p_from_pocket_id: params.fromPocketId,
    p_amount: params.amount,
    p_title: params.title,
    p_note: params.note,
    p_occurred_at: params.occurredAt,
  });
  if (error) throw error;
  return data;
}

type RawOutstandingComponents = {
  principal: string | number;
  interest: string | number;
  fee: string | number;
  late_fee: string | number;
  unallocated_credit: string | number;
  total: string | number;
};

export async function getCreditCardOutstandingComponents(
  supabase: SupabaseClient<Database>,
  cardAccountId: string,
): Promise<CreditCardOutstandingComponents | null> {
  const { data, error } = await supabase.rpc("get_credit_card_outstanding_components", {
    p_card_account_id: cardAccountId,
  });
  if (error) {
    logDatabaseErrorInDev("getCreditCardOutstandingComponents failed", error);
    return null;
  }
  const row = (data as RawOutstandingComponents[] | null)?.[0] ?? null;
  return row ? {
    principal: normalizeDatabaseMoney(row.principal),
    interest: normalizeDatabaseMoney(row.interest),
    fee: normalizeDatabaseMoney(row.fee),
    lateFee: normalizeDatabaseMoney(row.late_fee),
    unallocatedCredit: normalizeDatabaseMoney(row.unallocated_credit),
    total: normalizeDatabaseMoney(row.total),
  } : null;
}

export async function createCreditCardCashback(
  supabase: SupabaseClient<Database>,
  params: {
    cardAccountId: string;
    amount: string;
    title: string | null;
    note: string | null;
    occurredAt: string;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_credit_card_cashback", {
    p_card_account_id: params.cardAccountId,
    p_amount: params.amount,
    p_title: params.title,
    p_note: params.note,
    p_occurred_at: params.occurredAt,
  });
  if (error) throw error;
  return data;
}

export async function createCreditCardIssuerCharge(
  supabase: SupabaseClient<Database>,
  params: {
    cardAccountId: string;
    chargeKind: "INTEREST" | "FEE" | "LATE_FEE";
    amount: string;
    title: string | null;
    note: string | null;
    occurredAt: string;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_credit_card_issuer_charge", {
    p_card_account_id: params.cardAccountId,
    p_charge_kind: params.chargeKind,
    p_amount: params.amount,
    p_title: params.title,
    p_note: params.note,
    p_occurred_at: params.occurredAt,
  });
  if (error) throw error;
  return data;
}

type RawActivity = {
  event_id: string;
  event_kinds: CreditCardEventKind[];
  amount: string | number;
  transaction_id: string;
  occurred_at: string;
  title: string | null;
  category_name: string | null;
  is_voided: boolean;
};

export async function listCreditCardActivity(
  supabase: SupabaseClient<Database>,
  cardAccountId: string,
): Promise<CreditCardActivityItem[]> {
  const { data, error } = await supabase.rpc("get_credit_card_activity", {
    p_card_account_id: cardAccountId,
    p_limit: 50,
  });
  if (error) {
    logDatabaseErrorInDev("listCreditCardActivity failed", error);
    return [];
  }
  return ((data ?? []) as unknown as RawActivity[]).map((row) => ({
    eventId: row.event_id,
    eventKinds: row.event_kinds,
    amount: normalizeDatabaseMoney(row.amount),
    transactionId: row.transaction_id,
    occurredAt: row.occurred_at,
    title: row.title,
    categoryName: row.category_name,
    isVoided: row.is_voided,
  }));
}

export async function getCardEventForTransaction(
  supabase: SupabaseClient<Database>,
  transactionId: string,
): Promise<{ cardAccountId: string; eventKinds: CreditCardEventKind[] } | null> {
  const { data, error } = await supabase
    .from("credit_card_liability_events")
    .select("card_account_id, event_kind")
    .eq("transaction_id", transactionId)
    .order("event_kind");
  if (error) {
    logDatabaseErrorInDev("getCardEventForTransaction failed", error);
    return null;
  }
  const first = data?.[0];
  return first ? {
    cardAccountId: first.card_account_id,
    eventKinds: data.map((row) => row.event_kind as CreditCardEventKind),
  } : null;
}
