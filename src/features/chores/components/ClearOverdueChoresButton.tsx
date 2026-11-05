"use client";

import { useActionState, useState } from "react";

import { clearOverdueChoresAction } from "../actions";

export function ClearOverdueChoresButton({
  householdId,
  beforeDate,
  count,
}: {
  householdId: string;
  beforeDate: string;
  count: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    async (
      previous: Awaited<ReturnType<typeof clearOverdueChoresAction>>,
      form: FormData,
    ) => {
      const result = await clearOverdueChoresAction(previous, form);
      if (result.success) setConfirming(false);
      return result;
    },
    {},
  );
  const dateLabel = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${beforeDate}T12:00:00+07:00`));

  return (
    <div className="rounded-[1.15rem] border border-border bg-finance-surface-strong p-3">
      {confirming && count > 0 ? (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="beforeDate" value={beforeDate} />
          <p className="text-sm text-finance-text">
            เคลียร์งานบ้านที่ค้างก่อน {dateLabel} ทั้งหมด {count} งาน?
          </p>
          <p className="text-xs text-finance-muted">
            ประวัติจะระบุว่า “เคลียร์งานค้าง” พร้อมชื่อผู้เคลียร์
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending}
              className="min-h-11 rounded-xl bg-finance-primary px-4 text-sm font-medium text-finance-primary-foreground disabled:opacity-60"
            >
              {pending ? "กำลังเคลียร์…" : "ยืนยันเคลียร์งานค้าง"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-xl px-4 text-sm text-finance-muted"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={count === 0}
          onClick={() => setConfirming(true)}
          className="min-h-11 rounded-xl px-3 text-sm font-medium text-finance-primary-strong disabled:opacity-50"
        >
          เคลียร์งานค้างทั้งหมด ({count})
        </button>
      )}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-2 text-sm text-finance-primary-strong">
          เคลียร์งานค้างแล้ว {state.clearedCount} งาน
        </p>
      ) : null}
    </div>
  );
}
