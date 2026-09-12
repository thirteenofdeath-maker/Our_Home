/**
 * Display-only currency formatting. Never use the returned number for
 * further arithmetic — round-trip through `Intl.NumberFormat` is fine for
 * rendering, not for computing balances (see docs/DOMAIN_RULES.md).
 */
export function formatCurrency(amount: string | number, currency: string): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(numeric);
}

/** Convert PostgREST `numeric(14,2)` wire values to app decimal strings. */
export function normalizeDatabaseMoney(amount: string | number): string {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) throw new TypeError("Invalid database money value");
    return amount.toFixed(2);
  }

  const value = amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new TypeError("Invalid database money value");
  return `${match[1]}${match[2]}.${(match[3] ?? "").padEnd(2, "0")}`;
}

export function isNegative(amount: string): boolean {
  return amount.trim().startsWith("-");
}

function toCents(amount: string): bigint {
  const value = amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new TypeError("Invalid money value");
  const [, sign, whole, fraction = ""] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  return `${negative ? "-" : ""}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
}

/**
 * Exact decimal-string subtraction (`a - b`) via integer cents — never
 * JS floating point. For deriving a small display value (e.g. a
 * "remaining this month" figure) from two already-authoritative decimal
 * strings already loaded on the page; never a substitute for a
 * server-computed authoritative balance.
 */
export function subtractMoney(a: string, b: string): string {
  return formatCents(toCents(a) - toCents(b));
}

/** Exact decimal-string addition (`a + b`) via integer cents — see subtractMoney. */
export function addMoney(a: string, b: string): string {
  return formatCents(toCents(a) + toCents(b));
}

/**
 * Exact sum of decimal strings that already share one currency (the
 * caller is responsible for never mixing currencies — see
 * docs/DOMAIN_RULES.md). Used for small display-only aggregates derived
 * from an already-loaded list (e.g. "amount paid so far" across an
 * installment plan's own paid occurrences), never a substitute for a
 * server-computed authoritative total.
 */
export function sumMoney(amounts: string[]): string {
  return formatCents(amounts.reduce((total, amount) => total + toCents(amount), 0n));
}

/**
 * Exact ascending comparator for two same-currency decimal strings, via
 * integer cents — never `Number(a) - Number(b)`. For sorting a list of
 * monetary rows (e.g. `rows.sort((a, b) => compareMoney(b.amount, a.amount))`
 * for descending order).
 */
export function compareMoney(a: string, b: string): number {
  const diff = toCents(a) - toCents(b);
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}

/**
 * Presentation percentage of `amount` within `total` (same currency),
 * rounded to one decimal place — computed entirely from integer cents,
 * never `Number(amount) / Number(total)`. Returns 0 when `total` is
 * zero. For UI display/sizing only (e.g. a ranked-row percentage label
 * or a donut segment's ratio); never treat the result as money.
 */
export function percentOfTotal(amount: string, total: string): number {
  const totalCents = toCents(total);
  if (totalCents === 0n) return 0;
  const amountCents = toCents(amount);
  // Round-half-up in integer domain: round(x/y) == floor((2x + y) / (2y)).
  // Here x = amountCents * 1000 (so the quotient is already in tenths of
  // a percent) and y = totalCents.
  const tenths = (amountCents * 2000n + totalCents) / (2n * totalCents);
  return Number(tenths) / 10;
}
