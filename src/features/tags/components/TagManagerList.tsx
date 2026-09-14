import { archiveTagAction, restoreTagAction } from "../actions";
import { RenameTagForm } from "./RenameTagForm";
import type { Tag } from "../types";

function TagRow({ tag }: { tag: Tag }) {
  return (
    <li className="flex items-center justify-between py-2">
      <div>
        <p className={tag.archived_at ? "text-foreground-muted line-through" : ""}>#{tag.name}</p>
        <div className="mt-1 flex gap-3">{!tag.archived_at ? <RenameTagForm id={tag.id} currentName={tag.name} /> : null}</div>
      </div>
      {tag.archived_at ? (
        <form action={restoreTagAction}>
          <input type="hidden" name="id" value={tag.id} />
          <button type="submit" className="text-xs font-medium text-primary">
            กู้คืน
          </button>
        </form>
      ) : (
        <form action={archiveTagAction}>
          <input type="hidden" name="id" value={tag.id} />
          <button type="submit" className="text-xs font-medium text-danger">
            เก็บถาวร
          </button>
        </form>
      )}
    </li>
  );
}

export function TagManagerList({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) {
    return <p className="py-6 text-center text-sm text-foreground-muted">ยังไม่มีแท็ก</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface px-4">
      {tags.map((tag) => (
        <TagRow key={tag.id} tag={tag} />
      ))}
    </ul>
  );
}
