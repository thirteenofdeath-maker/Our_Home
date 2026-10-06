"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { Spinner } from "@/components/ui/Spinner";
import { initialActionState } from "@/lib/types/action-state";
import { sendInventoryToShoppingAction } from "../actions";

export function SendInventoryToShoppingButton({
  itemId,
  itemName,
}: {
  itemId: string;
  itemName: string;
}) {
  const [state, action, pending] = useActionState(
    sendInventoryToShoppingAction,
    initialActionState,
  );

  if (state.success) {
    return (
      <div
        className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1"
        role="status"
        aria-live="polite"
      >
        <span className="flex min-h-8 items-center gap-1.5 rounded-full bg-[#e3efdf] px-3 text-xs font-medium text-[#4f6754]">
          <span aria-hidden="true">✓</span>
          เพิ่มในรายการซื้อแล้ว
        </span>
        <Link
          href="/calendar?view=shopping"
          className="min-h-8 content-center text-xs font-medium text-finance-primary-strong underline underline-offset-2"
        >
          ดูรายการซื้อ
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-8 items-center gap-1.5 rounded-full bg-finance-primary-soft px-3 text-xs font-medium text-finance-primary-strong disabled:cursor-wait disabled:opacity-70"
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
