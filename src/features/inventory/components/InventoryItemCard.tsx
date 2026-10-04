import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import {
  sendInventoryToShoppingAction,
  adjustInventoryQuantityAction,
} from "../actions";
import {
  INVENTORY_CATEGORY_LABEL,
  inventoryDateLabel,
  inventoryQuantityLabel,
  isPastInventoryDate,
  isLowStock,
  type InventoryItem,
} from "../types";

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
  const quantity = Number(item.quantity);
  return (
    <Card className="rounded-[1rem] bg-finance-surface-strong p-2.5 shadow-none ring-1 ring-border/45">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Link href={`/calendar/inventory/${item.id}`} className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-finance-text">
              {item.name}
            </h3>
            {low ? (
              <span className="shrink-0 rounded-full bg-[#fce5db] px-1.5 py-0.5 text-[11px] font-medium text-[#a9513d]">
                ควรเติม
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
          {canEdit ? (
            <>
              <form action={adjustInventoryQuantityAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="delta" value="-1" />
                <button
                  type="submit"
                  disabled={quantity <= 0}
                  className="flex size-8 items-center justify-center rounded-full border border-finance-primary/30 text-base text-finance-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`ลดจำนวน ${item.name}`}
                >
                  −
                </button>
              </form>
              <form action={adjustInventoryQuantityAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="delta" value="1" />
                <button
                  type="submit"
                  className="flex size-8 items-center justify-center rounded-full border border-finance-primary/30 text-base text-finance-primary-strong"
                  aria-label={`เพิ่มจำนวน ${item.name}`}
                >
                  +
                </button>
              </form>
              {low ? (
                <form action={sendInventoryToShoppingAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button
                    type="submit"
                    className="flex size-8 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong"
                    aria-label={`ส่ง ${item.name} ไปรายการซื้อ`}
                    title="ส่งไปรายการซื้อ"
                  >
                    <AppIcon name="shopping" className="size-4" />
                  </button>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
