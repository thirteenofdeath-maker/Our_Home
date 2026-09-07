import { archiveCategoryAction, restoreCategoryAction } from "../actions";
import { RenameCategoryForm } from "./RenameCategoryForm";
import type { CategoryNode } from "../types";

function CategoryRow({ category, indent }: { category: CategoryNode; indent: boolean }) {
  return (
    <li className={`flex items-center justify-between py-2 ${indent ? "pl-6" : ""}`}>
      <div>
        <p className={category.archived_at ? "text-foreground-muted line-through" : ""}>{category.name}</p>
        <div className="mt-1 flex gap-3">
          {!category.archived_at ? <RenameCategoryForm id={category.id} currentName={category.name} /> : null}
        </div>
      </div>
      {category.archived_at ? (
        <form action={restoreCategoryAction}>
          <input type="hidden" name="id" value={category.id} />
          <button type="submit" className="text-xs font-medium text-primary">
            กู้คืน
          </button>
        </form>
      ) : (
        <form action={archiveCategoryAction}>
          <input type="hidden" name="id" value={category.id} />
          <button type="submit" className="text-xs font-medium text-danger">
            เก็บถาวร
          </button>
        </form>
      )}
    </li>
  );
}

export function CategoryManagerList({ tree }: { tree: CategoryNode[] }) {
  if (tree.length === 0) {
    return <p className="py-6 text-center text-sm text-foreground-muted">ยังไม่มีหมวดหมู่</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface px-4">
      {tree.map((category) => (
        <li key={category.id}>
          <ul className="divide-y divide-border">
            <CategoryRow category={category} indent={false} />
            {category.children.map((child) => (
              <CategoryRow key={child.id} category={child} indent />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
