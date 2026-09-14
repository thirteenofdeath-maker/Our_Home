import { z } from "zod";

/**
 * Money amounts are validated and passed around as decimal strings end to
 * end (form input -> Server Action -> Postgres `numeric`). We never round-
 * trip an amount through a JavaScript `number` for anything other than
 * *display* formatting (see `lib/utils/money.ts`) — floating point is not
 * the source of truth for any financial value here.
 *
 * Accepts up to 2 decimal places, must be strictly positive (a "zero
 * amount" transaction is never meaningful — see transaction_entries'
 * `amount <> 0` check in the database).
 */
const POSITIVE_DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

export const positiveAmountSchema = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .regex(POSITIVE_DECIMAL_PATTERN, "Enter a valid amount (up to 2 decimal places)")
  .refine((value) => !/^0(\.0{1,2})?$/.test(value), "Amount must be greater than zero");

export type PositiveAmount = z.infer<typeof positiveAmountSchema>;

/** Normalizes "120" / "120.5" / "120.50" to a consistent "120.50" string for storage. */
export function normalizeAmount(value: PositiveAmount): string {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
