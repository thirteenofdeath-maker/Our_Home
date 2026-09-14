"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * Trigger + open/close state only. The actual filter form (date range,
 * status, wallet, pocket, category, tag) is rendered server-side by the
 * page and passed in as `children` — this component never touches
 * `searchTransactions` or any filter's meaning, it only decides when the
 * form is visible.
 */
export function FinanceFilterSheet({ children, active }: { children?: ReactNode; active: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ตัวกรอง"
        aria-haspopup="dialog"
        className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-finance-surface-strong text-finance-text shadow-sm"
      >
        <AppIcon name="filter" />
        {active ? <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-finance-expense" /> : null}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="ตัวกรอง">
        {children}
      </BottomSheet>
    </>
  );
}
