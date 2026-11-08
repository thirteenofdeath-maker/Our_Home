"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils/cn";
import { sendInventoryToShoppingAction } from "../actions";

export function SendInventoryToShoppingButton({
  itemId,
  itemName,
  pendingShoppingId,
  canEdit = true,
  compact = false,
}: {
  itemId: string;
  itemName: string;
  pendingShoppingId?: string;
  canEdit?: boolean;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    sendInventoryToShoppingAction,
    {},
  );

  const shoppingItemId = pendingShoppingId ?? state.shoppingItemId;
  if (shoppingItemId) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          role="status"
          aria-live="polite"
          className="rounded-full bg-finance-primary-soft px-3 py-1.5 text-xs font-medium text-finance-primary-strong"
        >
          {state.shoppingItemId === shoppingItemId
            ? "เพิ่มในรายการซื้อแล้ว · รอซื้อ"
            : "รอซื้อ"}
        </span>
        <Link
          href={`/calendar?view=shopping&item=${shoppingItemId}`}
          className={cn(
            "content-center rounded-full px-2 font-medium text-finance-primary-strong underline underline-offset-2",
            compact ? "min-h-8 text-xs" : "min-h-11 text-sm",
          )}
        >
          ดูรายการซื้อ
        </Link>
      </div>
    );
  }

  if (!canEdit) return null;

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-finance-primary px-4 font-medium text-finance-primary-foreground disabled:cursor-wait disabled:opacity-70",
          compact ? "min-h-8 text-xs" : "min-h-11 text-sm",
        )}
        aria-label={`ส่ง ${itemName} ไปรายการซื้อ`}
      >
        {pending ? (
          <>
            <Spinner className="size-3.5 border-current/30 border-t-current" />
            กำลังส่ง…
          </>
        ) : (
          <>
            <AppIcon name="shopping" className="size-3.5" />
            ส่งไปซื้อ
          </>
        )}
      </button>
      {state.error ? (
        <p className="max-w-52 text-right text-[11px] text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
