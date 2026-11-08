import Link from "next/link";

import { Card } from "@/components/ui/Card";
import {
  INVENTORY_CATEGORY_LABEL,
  inventoryDateLabel,
  inventoryQuantityLabel,
  isPastInventoryDate,
  isLowStock,
  type InventoryItem,
} from "../types";
import { SendInventoryToShoppingButton } from "./SendInventoryToShoppingButton";
import { InventoryQuantityButtons } from "./InventoryQuantityButtons";

export function InventoryItemCard({
  item,
  canEdit,
  today,
  showCategory = true,
}: {
  item: InventoryItem;
  canEdit: boolean;
  today: string;
  showCategory?: boolean;
}) {
  const low = isLowStock(item);
  const outOfStock = Number(item.quantity) === 0;
  return (
    <Card className="rounded-[0.9rem] border border-border/65 bg-finance-surface-strong p-2.5 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Link href={`/calendar/inventory/${item.id}`} className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-finance-text">
              {item.name}
            </h3>
            {outOfStock || low ? (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${outOfStock ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}
              >
                {outOfStock ? "หมดแล้ว" : "ควรเติม"}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-finance-muted">
            {showCategory ? INVENTORY_CATEGORY_LABEL[item.category] : null}
            {showCategory && item.location ? " · " : null}
            {item.location ?? null}
            {item.expiry_date ? (
              <span
                className={
                  isPastInventoryDate(item.expiry_date, today)
                    ? "font-medium text-[#8f402f]"
                    : undefined
                }
              >
                {showCategory || item.location ? " · " : null}
                {isPastInventoryDate(item.expiry_date, today)
                  ? "หมดอายุแล้ว"
                  : "หมดอายุ"}{" "}
                {inventoryDateLabel(item.expiry_date)}
              </span>
            ) : null}
            {item.warranty_expires_on ? (
              <span>
                {showCategory || item.location || item.expiry_date
                  ? " · "
                  : null}
                ประกันถึง {inventoryDateLabel(item.warranty_expires_on)}
              </span>
            ) : null}
          </p>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-sm font-semibold tabular-nums text-finance-primary-strong">
            {inventoryQuantityLabel(item)}
          </span>
          {canEdit ? <InventoryQuantityButtons item={item} compact /> : null}
        </div>
      </div>
      {canEdit && low ? (
        <div className="mt-2 flex justify-end border-t border-border/50 pt-2">
          <SendInventoryToShoppingButton
            itemId={item.id}
            itemName={item.name}
            compact
          />
        </div>
      ) : null}
    </Card>
  );
}
