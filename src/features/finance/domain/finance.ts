import { isNegative, normalizeDatabaseMoney } from "@/lib/utils/money";

import type { FinanceRecentTransaction, FinanceSummary } from "../types";

export const FINANCE_TIME_ZONE = "Asia/Bangkok";

/** Only internal path this app ever redirects a transaction save back to. */
export const FINANCE_RETURN_TO = "/finance";

export function currentFinanceMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: FINANCE_TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}`;
}

export function financeMonthRange(month: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new TypeError("Invalid finance month");
  const [year, value] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 7);
  return { start: `${month}-01T00:00:00+07:00`, end: `${next}-01T00:00:00+07:00` };
}

/**
 * "YYYY-MM-DD" -> the next calendar day, same shape. Used to turn a
 * user-picked "to" date (inclusive, from a plain <input type="date">) into
 * an exclusive upper bound for an occurred_at range query — see
 * /finance/transactions search filters.
 */
export function nextLocalDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError("Invalid date");
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** "YYYY-MM" -> "YYYY-MM" shifted by `delta` months. Used for Budget month navigation (prev/next). */
export function shiftFinanceMonth(month: string, delta: number): string {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new TypeError("Invalid finance month");
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** "YYYY-MM" -> canonical first-of-month date string ("YYYY-MM-01"), matching `budgets.period_month`. */
export function financeMonthToPeriodMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new TypeError("Invalid finance month");
  return `${month}-01`;
}

export function positiveMoney(value: string | number): string {
  const normalized = normalizeDatabaseMoney(value);
  return normalized.startsWith("-") ? normalized.slice(1) : normalized;
}

// ---------------------------------------------------------------------
// Quick-add links: reuse the existing, already-verified creation routes —
// this is the entire "writer", nothing money-related is reimplemented
// here. `returnTo` is honored (whitelisted, see transactions/actions.ts)
// only for income/expense so "Finance -> add -> save -> back to Finance"
// works without touching the transfer flow.
// ---------------------------------------------------------------------

export function financeIncomeHref(walletId: string): string {
  return `/wallets/${walletId}/transactions/new?type=INCOME&returnTo=${encodeURIComponent(FINANCE_RETURN_TO)}`;
}

export function financeExpenseHref(walletId: string): string {
  return `/wallets/${walletId}/transactions/new?type=EXPENSE&returnTo=${encodeURIComponent(FINANCE_RETURN_TO)}`;
}

export function financeTransferHref(walletId: string): string {
  return `/wallets/${walletId}/transfer`;
}

// ---------------------------------------------------------------------
// Pure "wire response -> domain shape" mapping for get_finance_hub_summary
// (0028). Kept separate from the RPC call itself (finance/api.ts) so the
// one rule that actually matters here — every aggregate stays grouped by
// currency, never collapsed into one summed figure — is unit-testable
// without a database. See finance.test.ts.
// ---------------------------------------------------------------------

export interface FinanceSummaryWire {
  wallet_balances?: Array<{ wallet_id: string; currency: string; amount: string | number }>;
  currency_totals?: Array<{ currency: string; amount: string | number }>;
  month_totals?: Array<{ currency: string; income: string | number; expense: string | number }>;
  category_totals?: Array<{ category_id: string | null; name: string; currency: string; amount: string | number }>;
}

export function mapFinanceSummaryWire(wire: FinanceSummaryWire): FinanceSummary {
  return {
    walletBalances: (wire.wallet_balances ?? []).map((item) => ({
      walletId: item.wallet_id,
      currency: item.currency,
      amount: normalizeDatabaseMoney(item.amount),
    })),
    currencyTotals: (wire.currency_totals ?? []).map((item) => ({
      currency: item.currency,
      amount: normalizeDatabaseMoney(item.amount),
    })),
    monthTotals: (wire.month_totals ?? []).map((item) => ({
      currency: item.currency,
      income: normalizeDatabaseMoney(item.income),
      expense: normalizeDatabaseMoney(item.expense),
    })),
    categoryTotals: (wire.category_totals ?? []).map((item) => ({
      categoryId: item.category_id,
      name: item.name,
      currency: item.currency,
      amount: normalizeDatabaseMoney(item.amount),
    })),
  };
}

// ---------------------------------------------------------------------
// Pure "raw rows -> logical recent-transaction list" mapping. Mirrors the
// grouping convention already verified for wallet-scoped history
// (features/transactions/api.ts listTransactionsForWallet /
// docs/DOMAIN_RULES.md "Pocket transfer"): a transfer is one logical
// event, so a pocket transfer's two ledger entries (same wallet) become
// one row, and a wallet transfer's two entries (different wallets) also
// become one row (the Finance Hub query already only fetches the entries
// belonging to transactions the caller can see — there is exactly one
// `FinanceRecentTransaction` produced per `transaction_id`, never one per
// ledger entry).
// ---------------------------------------------------------------------

export interface FinanceTransactionRow {
  id: string;
  transaction_type: "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_PRINCIPAL";
  title: string | null;
  note: string | null;
  occurred_at: string;
  category: { name: string } | null;
  creator: { display_name: string } | null;
}

export interface FinanceEntryRow {
  transaction_id: string;
  amount: string | number;
  wallet_id: string;
  wallet: { name: string; currency: string } | null;
  pocket: { name: string } | null;
}

export function mapRecentFinanceTransactions(
  transactions: FinanceTransactionRow[],
  entries: FinanceEntryRow[],
): FinanceRecentTransaction[] {
  return transactions.flatMap((transaction): FinanceRecentTransaction[] => {
    const lines = entries.filter((entry) => entry.transaction_id === transaction.id);
    if (!lines.length) return [];

    const from = lines.find((line) => isNegative(normalizeDatabaseMoney(line.amount))) ?? lines[0];
    const to = lines.find((line) => !isNegative(normalizeDatabaseMoney(line.amount))) ?? lines[0];
    const viewed = transaction.transaction_type === "EXPENSE" ? from : to;

    const base: FinanceRecentTransaction = {
      transactionId: transaction.id,
      transactionType: transaction.transaction_type,
      title: transaction.title,
      note: transaction.note,
      occurredAt: transaction.occurred_at,
      categoryName: transaction.category?.name ?? null,
      walletName: viewed.wallet?.name ?? "?",
      pocketName: viewed.pocket?.name ?? "?",
      creatorName: transaction.creator?.display_name ?? null,
      // The caller (listRecentFinanceTransactions) always queries with
      // `.is("deleted_at", null)`, so every row reaching this mapper is
      // active by construction — see docs/FINANCE.md Phase B.
      voidedAt: null,
      amount: transaction.transaction_type === "EXPENSE" ? normalizeDatabaseMoney(viewed.amount) : positiveMoney(viewed.amount),
      currency: viewed.wallet?.currency ?? "THB",
    };

    if (transaction.transaction_type !== "TRANSFER" || lines.length < 2) return [base];

    if (from.wallet_id === to.wallet_id) {
      return [
        {
          ...base,
          amount: positiveMoney(to.amount),
          pocketTransfer: {
            fromPocketName: from.pocket?.name ?? "?",
            toPocketName: to.pocket?.name ?? "?",
            amount: positiveMoney(to.amount),
          },
        },
      ];
    }

    return [
      {
        ...base,
        amount: positiveMoney(to.amount),
        walletTransfer: {
          fromWalletName: from.wallet?.name ?? "?",
          fromPocketName: from.pocket?.name ?? "?",
          toWalletName: to.wallet?.name ?? "?",
          toPocketName: to.pocket?.name ?? "?",
        },
      },
    ];
  });
}
