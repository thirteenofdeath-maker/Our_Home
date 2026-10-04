import Link from "next/link";

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
    <Card className="rounded-[1.15rem] bg-finance-surface-strong p-3 shadow-none ring-1 ring-border/45">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Link
          href={`/calendar/inventory/${item.id}`}
          className="min-w-0 py-0.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-finance-text">{item.name}</h3>
            {low ? (
              <span className="rounded-full bg-[#fce5db] px-2 py-0.5 text-xs font-medium text-[#a9513d]">
                ควรเติม
              </span>
            ) : null}
          </div>
          {showCategory || item.location ? (
            <p className="mt-0.5 truncate text-sm text-finance-muted">
              {showCategory ? INVENTORY_CATEGORY_LABEL[item.category] : null}
              {showCategory && item.location ? " · " : null}
              {item.location ?? null}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-finance-muted">
            {item.expiry_date ? (
              <span
                className={`rounded-full px-2 py-0.5 ${
                  isPastInventoryDate(item.expiry_date, today)
                    ? "bg-[#fce5db] font-medium text-[#8f402f]"
                    : "bg-finance-primary-soft/60"
                }`}
              >
                {isPastInventoryDate(item.expiry_date, today)
                  ? "หมดอายุแล้ว"
                  : "หมดอายุ"}{" "}
                {inventoryDateLabel(item.expiry_date)}
              </span>
            ) : null}
            {item.warranty_expires_on ? (
              <span className="rounded-full bg-finance-primary-soft/60 px-2 py-0.5">
                ประกันถึง {inventoryDateLabel(item.warranty_expires_on)}
              </span>
            ) : null}
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-semibold tabular-nums text-finance-primary-strong">
            {inventoryQuantityLabel(item)}
          </span>
          {canEdit ? (
            <div className="flex items-center gap-1.5">
              <form action={adjustInventoryQuantityAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="delta" value="-1" />
                <button
                  type="submit"
                  disabled={quantity <= 0}
                  className="flex size-9 items-center justify-center rounded-full border border-finance-primary/30 text-lg text-finance-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="flex size-9 items-center justify-center rounded-full border border-finance-primary/30 text-lg text-finance-primary-strong"
                  aria-label={`เพิ่มจำนวน ${item.name}`}
                >
                  +
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
      {canEdit && low ? (
        <div className="mt-2 flex justify-end border-t border-border/60 pt-2">
          <form action={sendInventoryToShoppingAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              className="rounded-full bg-finance-primary-soft px-3 py-1.5 text-xs font-medium text-finance-primary-strong"
            >
              ส่งไปรายการซื้อ
            </button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
