import { notFound } from "next/navigation";

import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  archivePlanReminderAction,
  togglePlanReminderAction,
} from "@/features/plan/actions";
import { getPlanReminder } from "@/features/plan/api";
import { ReminderForm } from "@/features/plan/components/ReminderForm";
import {
  reminderDateLabel,
  reminderRecurrenceLabel,
} from "@/features/plan/domain";
import { requireUser } from "@/lib/auth/require-user";

export default async function ReminderDetailPage({
  params,
}: {
  params: Promise<{ reminderId: string }>;
}) {
  const { reminderId } = await params;
  const { supabase } = await requireUser();
  const reminder = await getPlanReminder(supabase, reminderId);
  if (!reminder) notFound();

  return (
    <div className="finance-scope -mx-4 -mt-2 flex flex-col gap-4 px-4 pt-3">
      <header>
        <p className="text-sm text-finance-muted">รายการเตือน</p>
        <h1 className="text-xl font-semibold text-finance-text">
          {reminder.title}
        </h1>
      </header>
      <Card className="rounded-[1.5rem] bg-finance-surface-strong">
        <p className="font-medium text-finance-text">
          {reminderDateLabel(reminder.reminds_at)}
        </p>
        <p className="mt-1 text-sm text-finance-muted">
          {reminderRecurrenceLabel[reminder.recurrence]} ·{" "}
          {reminder.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
        </p>
        {reminder.note ? (
          <p className="mt-4 whitespace-pre-wrap text-finance-text">
            {reminder.note}
          </p>
        ) : null}
      </Card>
      <FormSheetButton
        ariaLabel="แก้ไขรายการเตือน"
        sheetTitle="แก้ไขรายการเตือน"
        tone="finance"
        form={<ReminderForm hasHousehold reminder={reminder} />}
        triggerClassName={buttonClassName("secondary", "md")}
      >
        แก้ไข
      </FormSheetButton>
      <form action={togglePlanReminderAction}>
        <input type="hidden" name="reminderId" value={reminder.id} />
        <input
          type="hidden"
          name="completed"
          value={String(!reminder.is_completed)}
        />
        <button className={buttonClassName("primary", "md")} type="submit">
          {reminder.is_completed ? "ทำเครื่องหมายว่ายังไม่เสร็จ" : "เสร็จแล้ว"}
        </button>
      </form>
      <form action={archivePlanReminderAction}>
        <input type="hidden" name="reminderId" value={reminder.id} />
        <input type="hidden" name="archived" value="true" />
        <button className={buttonClassName("secondary", "md")} type="submit">
          เก็บเข้าคลัง
        </button>
      </form>
    </div>
  );
}
