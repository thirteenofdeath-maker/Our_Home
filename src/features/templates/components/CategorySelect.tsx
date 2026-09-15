import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";

export function CategorySelect({
  categories,
  transactionType,
  walletId,
  defaultValue = "",
}: {
  categories: CategoryNode[];
  transactionType: "INCOME" | "EXPENSE";
  walletId?: string;
  defaultValue?: string;
}) {
  return (
    <CategoryPicker
      name="categoryId"
      categories={categories}
      transactionType={transactionType}
      walletId={walletId}
      defaultSelected={defaultValue ? { id: defaultValue, label: "" } : null}
      allowEmpty
      placeholder="ไม่กำหนด"
    />
  );
}
