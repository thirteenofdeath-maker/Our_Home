"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  if (count === 0) return null;
  const dateLabel = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${beforeDate}T12:00:00+07:00`));

  return (
    <ConfirmDialog
      triggerLabel="เคลียร์งานค้าง"
      triggerVariant="secondary"
      triggerClassName="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-finance-primary-soft px-3 text-xs font-medium text-finance-primary-strong transition-colors hover:bg-finance-primary-soft/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary"
      sheetTitle="เคลียร์งานค้าง"
      description={`เคลียร์งานบ้านที่ค้างก่อน ${dateLabel} ทั้งหมด ${count} งาน?`}
      confirmLabel="ยืนยันเคลียร์"
      action={clearOverdueChoresAction}
      hiddenFields={{ householdId, beforeDate }}
    >
      <p className="text-xs text-foreground-muted">
        ประวัติจะระบุว่า “เคลียร์งานค้าง” พร้อมชื่อผู้เคลียร์
      </p>
    </ConfirmDialog>
  );
}
