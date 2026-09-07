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

export function isNegative(amount: string): boolean {
  return amount.trim().startsWith("-");
}
