import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
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
      className={`rounded-[1.15rem] bg-finance-surface-strong p-3 ${purchased ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-2.5">
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
              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-semibold ${purchased ? "border-finance-primary bg-finance-primary text-finance-primary-foreground" : "border-finance-primary/55 text-finance-primary-strong"} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {purchased ? "✓" : ""}
            </button>
          </form>
        ) : (
          <span
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] ${purchased ? "border-finance-primary bg-finance-primary text-finance-primary-foreground" : "border-border"}`}
          >
            {purchased ? "✓" : ""}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h3
              className={`truncate font-semibold text-finance-text ${purchased ? "line-through" : ""}`}
            >
              {item.name}
            </h3>
            {item.estimated_amount ? (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-finance-primary-strong">
                {formatCurrency(item.estimated_amount, item.currency)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-finance-muted">
            {quantityLabel(item)}
            {item.store ? ` · ${item.store}` : ""}
            {" · "}
            {assignee
              ? (assignee.profile?.display_name ??
                assignee.profile?.email ??
                "สมาชิก")
              : "ยังไม่มอบหมาย"}
            {purchased
              ? ` · ซื้อแล้ว${purchaser ? `โดย ${purchaser.profile?.display_name ?? "สมาชิก"}` : ""}`
              : ""}
          </p>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            {item.note ? (
              <span className="min-w-0 truncate rounded-full bg-finance-primary-soft/55 px-2 py-0.5 text-xs text-finance-muted">
                {item.note}
              </span>
            ) : (
              <span />
            )}
            {canEdit ? (
              <div className="flex shrink-0 items-center gap-1.5">
                {item.expense_transaction_id ? (
                  <Link
                    href={`/finance/transactions/${item.expense_transaction_id}`}
                    className="rounded-full bg-finance-primary-soft px-2.5 py-1.5 text-xs font-medium text-finance-primary-strong"
                  >
                    ดูรายจ่าย
                  </Link>
                ) : (
                  <Link
                    href={`/calendar/shopping/${item.id}/expense`}
                    className="rounded-full bg-finance-primary-soft px-2.5 py-1.5 text-xs font-medium text-finance-primary-strong"
                  >
                    สร้างรายจ่าย
                  </Link>
                )}
                <details className="group relative">
                  <summary
                    className="flex size-8 cursor-pointer list-none items-center justify-center rounded-full border border-finance-primary/20 bg-finance-primary-soft/70 text-finance-primary-strong marker:hidden [&::-webkit-details-marker]:hidden"
                    aria-label={`จัดการ ${item.name}`}
                  >
                    <AppIcon name="more" className="size-5" strokeWidth={2.8} />
                  </summary>
                  <div className="absolute right-0 top-10 z-10 flex min-w-40 flex-col overflow-hidden rounded-[1rem] bg-finance-surface-strong p-1.5 text-sm font-medium shadow-card ring-1 ring-border/70">
                    <FormSheetButton
                      triggerClassName="rounded-[0.75rem] px-3 py-2 text-left text-finance-primary-strong"
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
                      <button
                        type="submit"
                        className="w-full rounded-[0.75rem] px-3 py-2 text-left text-finance-muted"
                      >
                        นำออกจากรายการ
                      </button>
                    </form>
                  </div>
                </details>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
