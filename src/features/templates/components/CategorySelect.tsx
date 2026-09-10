import { Select } from "@/components/ui/Field";
import type { CategoryNode } from "@/features/categories/types";

/**
 * Plain flat select — no inline "quick create a category" affordance,
 * unlike CategoryPicker/ExpenseCategorySelect used by the transaction
 * form. A Template's Wallet is optional, and CategoryPicker's inline
 * create flow assumes a real Wallet id to scope the new category to
 * (see docs/FINANCE.md Phase F "Category rules"); keeping Template's own
 * category field to plain selection avoids that entirely rather than
 * threading a second, riskier code path through a Phase B/C component.
 */
export function CategorySelect({ categories, defaultValue = "" }: { categories: CategoryNode[]; defaultValue?: string }) {
  return (
    <Select id="categoryId" name="categoryId" defaultValue={defaultValue}>
      <option value="">ไม่กำหนด</option>
      {categories.flatMap((category) => [
        <option key={category.id} value={category.id}>
          {category.name}
        </option>,
        ...category.children.map((child) => (
          <option key={child.id} value={child.id}>
            {category.name} &gt; {child.name}
          </option>
        )),
      ])}
    </Select>
  );
}
