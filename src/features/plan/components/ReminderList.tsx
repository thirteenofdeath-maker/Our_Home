import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { togglePlanReminderAction } from "../actions";
import { reminderDateLabel, reminderRecurrenceLabel } from "../domain";
import type { PlanReminder } from "../types";

export function ReminderList({ reminders }: { reminders: PlanReminder[] }) {
  if (!reminders.length) {
    return (
      <Card className="rounded-[1.25rem] bg-finance-surface-strong">
        <p className="text-sm text-finance-muted">ยังไม่มีรายการเตือน</p>
      </Card>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {reminders.map((reminder) => (
        <Card
          key={reminder.id}
          className="flex min-w-0 items-start gap-3 rounded-[1.25rem] bg-finance-surface-strong"
        >
          <form action={togglePlanReminderAction}>
            <input type="hidden" name="reminderId" value={reminder.id} />
            <input
              type="hidden"
              name="completed"
              value={String(!reminder.is_completed)}
            />
            <button
              type="submit"
              aria-label={
                reminder.is_completed
                  ? "ทำเครื่องหมายว่ายังไม่เสร็จ"
                  : "ทำเครื่องหมายว่าเสร็จ"
              }
              className="flex size-8 items-center justify-center rounded-full border border-finance-primary text-finance-primary-strong"
            >
              {reminder.is_completed ? "✓" : ""}
            </button>
          </form>
          <Link
            href={`/calendar/reminders/${reminder.id}`}
            className="min-w-0 flex-1"
          >
            <p
              className={`font-medium text-finance-text ${reminder.is_completed ? "text-finance-muted line-through" : ""}`}
            >
              {reminder.title}
            </p>
            <p className="text-sm text-finance-muted">
              {reminderDateLabel(reminder.reminds_at)} ·{" "}
              {reminderRecurrenceLabel[reminder.recurrence]}
            </p>
          </Link>
        </Card>
      ))}
    </div>
  );
}
