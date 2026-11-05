import { z } from "zod";

import { positiveAmountSchema } from "@/lib/validation/money";
import type { Database } from "@/types/database";

export const expenseCategories = {
  shopping: "ของใช้และของกิน",
  utilities: "ค่าน้ำ ค่าไฟ และบิลบ้าน",
  pets: "สัตว์เลี้ยง",
  home: "ดูแลบ้าน",
  other: "อื่น ๆ",
} as const;

export const expenseInput = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  category: z.enum(expenseCategories),
  amount: positiveAmountSchema.refine((value) => Number(value) > 0),
  paidOn: z.iso.date(),
  payerId: z.uuid(),
  itemIds: z.array(z.uuid()).max(100),
  edit: z.boolean(),
});

export type HouseholdExpense =
  Database["public"]["Tables"]["household_expenses"]["Row"];

export function totalExpenseAmount(rows: Pick<HouseholdExpense, "amount">[]) {
  const total = rows.reduce((sum, row) => {
    const [whole, fraction = ""] = String(row.amount).split(".");
    return sum + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  }, 0n);
  return `${total / 100n}.${String(total % 100n).padStart(2, "0")}`;
}
