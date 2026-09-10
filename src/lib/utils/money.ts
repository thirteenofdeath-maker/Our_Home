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
