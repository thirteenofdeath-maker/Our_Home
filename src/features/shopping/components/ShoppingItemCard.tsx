import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import type { HouseholdMemberWithProfile } from "@/features/household/types";
import { formatCurrency } from "@/lib/utils/money";
import {
  archiveShoppingItemAction,
  toggleShoppingItemAction,
} from "../actions";
import type { ShoppingItem } from "../types";
import { ShoppingItemForm } from "./ShoppingItemForm";

function quantityLabel(item: ShoppingItem) {
  const quantity = Number(item.quantity);
  return `${Number.isInteger(quantity) ? quantity : quantity.toLocaleString("th-TH", { maximumFractionDigits: 3 })}${item.unit ? ` ${item.unit}` : ""}`;
}

export function ShoppingItemCard({
  item,
  members,
  canEdit,
}: {
  item: ShoppingItem;
  members: HouseholdMemberWithProfile[];
  canEdit: boolean;
}) {
  const assignee = members.find(
    (member) => member.id === item.assigned_member_id,
  );
  const purchaser = members.find(
    (member) => member.user_id === item.purchased_by,
  );
  const purchased = Boolean(item.purchased_at);
  const cannotUncheck = purchased && Boolean(item.expense_transaction_id);

  return (
    <Card
      className={`rounded-[1.35rem] bg-finance-surface-strong ${purchased ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-3">
        {canEdit ? (
          <form action={toggleShoppingItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="purchased" value={String(!purchased)} />
            <button
              type="submit"
              disabled={cannotUncheck}
              aria-label={
                purchased
                  ? "นำกลับเข้ารายการที่ต้องซื้อ"
                  : "ทำเครื่องหมายว่าซื้อแล้ว"
              }
              className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${purchased ? "border-finance-primary bg-finance-primary text-white" : "border-finance-primary/50 text-finance-primary-strong"} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {purchased ? "✓" : ""}
            </button>
          </form>
        ) : (
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${purchased ? "border-finance-primary bg-finance-primary text-white" : "border-border"}`}
          >
            {purchased ? "✓" : ""}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className={`font-semibold text-finance-text ${purchased ? "line-through" : ""}`}
              >
                {item.name}
              </h3>
              <p className="mt-0.5 text-sm text-finance-muted">
                {quantityLabel(item)}
                {item.store ? ` · ${item.store}` : ""}
              </p>
            </div>
            {item.estimated_amount ? (
              <span className="shrink-0 rounded-full bg-finance-primary-soft px-2.5 py-1 text-xs font-medium text-finance-primary-strong">
                {formatCurrency(item.estimated_amount, item.currency)}
              </span>
            ) : null}
          </div>
          {item.note ? (
            <p className="mt-2 text-sm text-finance-muted">{item.note}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-finance-muted">
            <span className="rounded-full bg-finance-primary-soft/55 px-2.5 py-1">
              {assignee
                ? `รับผิดชอบ: ${assignee.profile?.display_name ?? assignee.profile?.email ?? "สมาชิก"}`
                : "ยังไม่มอบหมาย"}
            </span>
            {purchased ? (
              <span>
                ซื้อแล้ว
                {purchaser
                  ? `โดย ${purchaser.profile?.display_name ?? "สมาชิก"}`
                  : ""}
              </span>
            ) : null}
          </div>
          {canEdit ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/70 pt-3 text-sm font-medium">
              {item.expense_transaction_id ? (
                <Link
                  href={`/finance/transactions/${item.expense_transaction_id}`}
                  className="text-finance-primary-strong"
                >
                  ดูรายจ่าย
                </Link>
              ) : (
                <Link
                  href={`/shopping/${item.id}/expense`}
                  className="text-finance-primary-strong"
                >
                  สร้างรายจ่าย
                </Link>
              )}
              <FormSheetButton
                triggerClassName="text-finance-primary-strong"
                ariaLabel={`แก้ไข ${item.name}`}
                sheetTitle="แก้ไขรายการซื้อ"
                form={
                  <ShoppingItemForm
                    householdId={item.household_id}
                    members={members.map((member) => ({
                      id: member.id,
                      label:
                        member.profile?.display_name ??
                        member.profile?.email ??
                        "สมาชิก",
                    }))}
                    item={item}
                  />
                }
                tone="finance"
              >
                แก้ไข
              </FormSheetButton>
              <form action={archiveShoppingItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" className="text-finance-muted">
                  นำออกจากรายการ
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
