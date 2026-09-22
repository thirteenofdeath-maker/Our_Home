import Link from "next/link";

import { Card } from "@/components/ui/Card";
import {
  sendInventoryToShoppingAction,
  setInventoryQuantityAction,
} from "../actions";
import {
  INVENTORY_CATEGORY_LABEL,
  inventoryDateLabel,
  inventoryQuantityLabel,
  isLowStock,
  type InventoryItem,
} from "../types";

export function InventoryItemCard({
  item,
  canEdit,
}: {
  item: InventoryItem;
  canEdit: boolean;
}) {
  const low = isLowStock(item);
  const quantity = Number(item.quantity);
  return (
    <Card className="rounded-[1.35rem] bg-finance-surface-strong">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/inventory/${item.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-finance-text">{item.name}</h3>
            {low ? (
              <span className="rounded-full bg-[#fce5db] px-2 py-0.5 text-xs font-medium text-[#a9513d]">
                ควรเติม
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-finance-muted">
            {INVENTORY_CATEGORY_LABEL[item.category]}
            {item.location ? ` · ${item.location}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-finance-muted">
            {item.expiry_date ? (
              <span className="rounded-full bg-finance-primary-soft/60 px-2.5 py-1">
                หมดอายุ {inventoryDateLabel(item.expiry_date)}
              </span>
            ) : null}
            {item.warranty_expires_on ? (
              <span className="rounded-full bg-finance-primary-soft/60 px-2.5 py-1">
                ประกันถึง {inventoryDateLabel(item.warranty_expires_on)}
              </span>
            ) : null}
          </div>
        </Link>
        <span className="shrink-0 text-lg font-semibold text-finance-primary-strong">
          {inventoryQuantityLabel(item)}
        </span>
      </div>
      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <form action={setInventoryQuantityAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input
              type="hidden"
              name="quantity"
              value={Math.max(0, quantity - 1)}
            />
            <button
              className="flex size-9 items-center justify-center rounded-full border border-finance-primary/30 text-lg text-finance-primary-strong"
              aria-label={`ลดจำนวน ${item.name}`}
            >
              −
            </button>
          </form>
          <form action={setInventoryQuantityAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="quantity" value={quantity + 1} />
            <button
              className="flex size-9 items-center justify-center rounded-full border border-finance-primary/30 text-lg text-finance-primary-strong"
              aria-label={`เพิ่มจำนวน ${item.name}`}
            >
              +
            </button>
          </form>
          <form action={sendInventoryToShoppingAction} className="ml-auto">
            <input type="hidden" name="itemId" value={item.id} />
            <button className="rounded-full bg-finance-primary-soft px-3 py-2 text-xs font-medium text-finance-primary-strong">
              {item.shopping_item_id
                ? "อยู่ในรายการซื้อแล้ว"
                : "ส่งไปรายการซื้อ"}
            </button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
