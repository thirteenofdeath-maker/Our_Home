import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";

export function ExpenseCategorySelect({
  categories,
  walletId,
  defaultValue = "",
}: {
  categories: CategoryNode[];
  walletId?: string;
  defaultValue?: string;
}) {
  return (
    <CategoryPicker
      name="categoryId"
      categories={categories}
      transactionType="EXPENSE"
      walletId={walletId}
      defaultSelected={defaultValue ? { id: defaultValue, label: "" } : null}
      allowCreate={Boolean(walletId)}
    />
  );
}
