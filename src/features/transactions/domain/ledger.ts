/**
 * Pure, dependency-free mirror of the signed-entry rules implemented by the
 * `create_income_expense_transaction` / `create_pocket_transfer` /
 * `create_wallet_transfer` Postgres functions (see
 * supabase/migrations/0010_functions_rpc.sql). Kept here so the core money
 * rules in docs/DOMAIN_RULES.md are independently unit-testable without a
 * database — see `ledger.test.ts`.
 *
 * All arithmetic is done on integer cents (via bigint), never on
 * JavaScript `number`, so it cannot suffer float rounding error
 * (e.g. 0.1 + 0.2 !== 0.3 in IEEE 754 doubles).
 */

export interface LedgerEntry {
  walletId: string;
  pocketId: string;
  /** Signed decimal string, e.g. "120.00" or "-120.00". */
  amount: string;
}

function toCents(decimal: string): bigint {
  const negative = decimal.trim().startsWith("-");
  const unsigned = decimal.trim().replace(/^-/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = BigInt(whole || "0") * 100n + BigInt((fraction + "00").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function sumAmounts(amounts: string[]): string {
  const totalCents = amounts.reduce((sum, amount) => sum + toCents(amount), 0n);
  return fromCents(totalCents);
}

export function negate(amount: string): string {
  return fromCents(-toCents(amount));
}

export function pocketBalance(entries: LedgerEntry[], pocketId: string): string {
  return sumAmounts(entries.filter((e) => e.pocketId === pocketId).map((e) => e.amount));
}

export function walletBalance(entries: LedgerEntry[], walletId: string): string {
  return sumAmounts(entries.filter((e) => e.walletId === walletId).map((e) => e.amount));
}

export function netWorth(entries: LedgerEntry[]): string {
  return sumAmounts(entries.map((e) => e.amount));
}

/** Mirrors create_income_expense_transaction's signed-entry rule. */
export function buildIncomeExpenseEntries(params: {
  transactionType: "INCOME" | "EXPENSE";
  walletId: string;
  pocketId: string;
  amount: string; // positive decimal string
}): LedgerEntry[] {
  const signedAmount = params.transactionType === "INCOME" ? params.amount : negate(params.amount);
  return [{ walletId: params.walletId, pocketId: params.pocketId, amount: signedAmount }];
}

/** Mirrors create_pocket_transfer's signed-entry rule (same wallet, two pockets). */
export function buildPocketTransferEntries(params: {
  walletId: string;
  fromPocketId: string;
  toPocketId: string;
  amount: string; // positive decimal string
}): LedgerEntry[] {
  return [
    { walletId: params.walletId, pocketId: params.fromPocketId, amount: negate(params.amount) },
    { walletId: params.walletId, pocketId: params.toPocketId, amount: params.amount },
  ];
}

/** Mirrors create_wallet_transfer's signed-entry rule (two wallets). */
export function buildWalletTransferEntries(params: {
  fromWalletId: string;
  fromPocketId: string;
  toWalletId: string;
  toPocketId: string;
  amount: string; // positive decimal string
}): LedgerEntry[] {
  return [
    { walletId: params.fromWalletId, pocketId: params.fromPocketId, amount: negate(params.amount) },
    { walletId: params.toWalletId, pocketId: params.toPocketId, amount: params.amount },
  ];
}
