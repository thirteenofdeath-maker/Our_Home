import { Select } from "@/components/ui/Field";
import type { CategoryNode } from "@/features/categories/types";

export function ExpenseCategorySelect({ categories, defaultValue = "" }: { categories: CategoryNode[]; defaultValue?: string }) {
  return (
    <Select id="categoryId" name="categoryId" defaultValue={defaultValue} required>
      <option value="" disabled>
        เลือกหมวดหมู่
      </option>
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
