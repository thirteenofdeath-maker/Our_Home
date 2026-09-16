import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeDatabaseMoney } from "@/lib/utils/money";
import type { Database, MoneyScope } from "@/types/database";

import type { FinanceReport } from "./types";

type Wire = {
  months?: Array<{
    month: string;
    currency: string;
    income: string | number;
    expense: string | number;
  }>;
  days?: Array<{
    date: string;
    currency: string;
    income: string | number;
    expense: string | number;
  }>;
  categories?: Array<{
    type: "INCOME" | "EXPENSE";
    category_id: string | null;
    name: string;
    currency: string;
    amount: string | number;
  }>;
};

export async function getFinanceReport(
  supabase: SupabaseClient<Database>,
  scope: MoneyScope,
  householdId: string | null,
  start: string,
  end: string,
): Promise<FinanceReport> {
  const { data, error } = await supabase.rpc("get_finance_reports", {
    p_scope: scope,
    p_household_id: householdId,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  const wire = (data ?? {}) as Wire;
  return {
    months: (wire.months ?? []).map((item) => ({
      ...item,
      income: normalizeDatabaseMoney(item.income),
      expense: normalizeDatabaseMoney(item.expense),
    })),
    days: (wire.days ?? []).map((item) => ({
      ...item,
      income: normalizeDatabaseMoney(item.income),
      expense: normalizeDatabaseMoney(item.expense),
    })),
    categories: (wire.categories ?? []).map((item) => ({
      type: item.type,
      categoryId: item.category_id,
      name: item.name,
      currency: item.currency,
      amount: normalizeDatabaseMoney(item.amount),
    })),
  };
}
