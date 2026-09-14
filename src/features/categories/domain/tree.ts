import type { Category, CategoryNode } from "../types";

/**
 * Builds the two-level (category -> subcategory) tree the V1 UI displays,
 * from the flat list RLS/the repository returns. Pure and unit-tested
 * independently of Supabase (see tree.test.ts).
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];

  for (const category of byId.values()) {
    if (category.parent_id && byId.has(category.parent_id)) {
      byId.get(category.parent_id)!.children.push(category);
    } else {
      roots.push(category);
    }
  }

  const bySortOrder = (a: Category, b: Category) => a.sort_order - b.sort_order;
  roots.sort(bySortOrder);
  for (const node of roots) node.children.sort(bySortOrder);

  return roots;
}
