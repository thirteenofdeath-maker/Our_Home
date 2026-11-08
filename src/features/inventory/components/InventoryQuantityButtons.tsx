import { ActionForm } from "@/components/ui/ActionForm";
import { cn } from "@/lib/utils/cn";
import { adjustInventoryQuantityAction } from "../actions";
import type { InventoryItem } from "../types";

export function InventoryQuantityButtons({
  item,
  compact = false,
}: {
  item: InventoryItem;
  compact?: boolean;
}) {
  const buttonClass = cn(
    "flex items-center justify-center rounded-full border border-finance-primary/30 text-lg text-finance-primary-strong disabled:opacity-40",
    compact ? "size-8" : "size-11",
  );

  return (
    <ActionForm action={adjustInventoryQuantityAction} className="shrink-0">
      <input type="hidden" name="itemId" value={item.id} />
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          name="delta"
          value="-1"
          disabled={Number(item.quantity) <= 0}
          className={buttonClass}
          aria-label={`ลดจำนวน ${item.name}`}
        >
          −
        </button>
        <button
          type="submit"
          name="delta"
          value="1"
          className={buttonClass}
          aria-label={`เพิ่มจำนวน ${item.name}`}
        >
          +
        </button>
      </div>
    </ActionForm>
  );
}
