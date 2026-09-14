/**
 * Phase V (0052): client-side mirror of validate_optional_charge_amount's
 * shape rule — null+null (no charge) or both present, never one without
 * the other. Pure and unit-tested independently of Supabase/Server
 * Actions (see transfer-charge-validation.test.ts) — kept out of
 * actions.ts because that file's "use server" directive requires every
 * top-level export to be an async function.
 */
export function validateOptionalCharge(amount: string | null, categoryId: string | null, label: string): string | null {
  if ((amount === null) !== (categoryId === null)) {
    // amount === null means a category WAS chosen but no amount was
    // entered — the missing field is the amount. Conversely, an amount
    // without a category is missing the category.
    return amount === null ? `กรุณาระบุจำนวนเงิน${label}` : `กรุณาเลือกหมวดหมู่สำหรับ${label}`;
  }
  return null;
}
