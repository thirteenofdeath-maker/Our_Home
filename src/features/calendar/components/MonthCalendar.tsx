import Link from "next/link";

import { Card } from "@/components/ui/Card";

import {
  formatEventTime,
  monthDays,
  shiftMonth,
  toBangkokInput,
} from "../domain/calendar";
import type { CalendarEventView } from "../types";
import type { CalendarFinanceItem } from "../finance";
import { togglePlanTaskAction } from "@/features/plan/actions";
import { planDateLabel } from "@/features/plan/domain";
import type { PlanReminder, PlanTask } from "@/features/plan/types";
import { reminderDateLabel } from "@/features/plan/domain";
import { PET_CARE_RECORD_LABEL, petCareDateLabel } from "@/features/pets/domain/care-record";
import type { PetCareRecord } from "@/features/pets/types";

function eventDate(event: CalendarEventView) {
  return event.is_all_day
    ? event.all_day_date
    : toBangkokInput(event.starts_at).slice(0, 10);
}

export function MonthCalendar({
  month,
  selected,
  today,
  events,
  financeItems = [],
  tasks = [],
  reminders = [],
  petCareRecords = [],
}: {
  month: string;
  selected: string;
  today: string;
  events: CalendarEventView[];
  financeItems?: CalendarFinanceItem[];
  tasks?: PlanTask[];
  reminders?: PlanReminder[];
  petCareRecords?: (PetCareRecord & { pet: { name: string } | null })[];
}) {
  const byDate = new Map<string, CalendarEventView[]>();
  for (const event of events) {
    const date = eventDate(event);
    if (date) byDate.set(date, [...(byDate.get(date) ?? []), event]);
  }
  const selectedEvents = byDate.get(selected) ?? [];
  const selectedFinance = financeItems.filter((item) => item.date === selected);
  const selectedTasks = tasks.filter((task) => task.due_date === selected);
  const selectedReminders = reminders.filter(
    (reminder) => toBangkokInput(reminder.reminds_at).slice(0, 10) === selected,
  );
  const selectedPetCare = petCareRecords.filter(
    (record) => toBangkokInput(record.scheduled_at).slice(0, 10) === selected,
  );
  const financeCountByDate = new Map<string, number>();
  const taskCountByDate = new Map<string, number>();
  const reminderCountByDate = new Map<string, number>();
  const petCareCountByDate = new Map<string, number>();
  for (const item of financeItems)
    financeCountByDate.set(
      item.date,
      (financeCountByDate.get(item.date) ?? 0) + 1,
    );
  for (const task of tasks) {
    if (task.due_date && !task.is_completed) {
      taskCountByDate.set(
        task.due_date,
        (taskCountByDate.get(task.due_date) ?? 0) + 1,
      );
    }
  }
  for (const reminder of reminders) {
    if (reminder.is_completed) continue;
    const date = toBangkokInput(reminder.reminds_at).slice(0, 10);
    reminderCountByDate.set(date, (reminderCountByDate.get(date) ?? 0) + 1);
  }
  for (const record of petCareRecords) {
    const date = toBangkokInput(record.scheduled_at).slice(0, 10);
    petCareCountByDate.set(date, (petCareCountByDate.get(date) ?? 0) + 1);
  }

  return (
    <>
      <section className="rounded-[1.5rem] bg-finance-surface-strong p-3 shadow-card sm:p-4">
        <nav
          aria-label="เปลี่ยนเดือน"
          className="flex items-center justify-between"
        >
          <Link
            className="flex min-h-11 items-center px-2 text-sm font-medium text-finance-primary-strong"
            href={`/calendar?month=${shiftMonth(month, -1)}`}
          >
            เดือนก่อน
          </Link>
          <h2 className="font-semibold text-finance-text">
            {new Intl.DateTimeFormat("th-TH", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${month}-01T00:00:00Z`))}
          </h2>
          <Link
            className="flex min-h-11 items-center px-2 text-sm font-medium text-finance-primary-strong"
            href={`/calendar?month=${shiftMonth(month, 1)}`}
          >
            เดือนถัดไป
          </Link>
        </nav>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-finance-muted">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => (
            <div key={day}>{day}</div>
          ))}
          {monthDays(month).map((day) => {
            const dayEvents = byDate.get(day.date) ?? [];
            const isSelected = day.date === selected;
            const isToday = day.date === today;
            const financeCount = financeCountByDate.get(day.date) ?? 0;
            const taskCount = taskCountByDate.get(day.date) ?? 0;
            const reminderCount = reminderCountByDate.get(day.date) ?? 0;
            const petCareCount = petCareCountByDate.get(day.date) ?? 0;
            return (
              <Link
                key={day.date}
                href={`/calendar?month=${month}&date=${day.date}`}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${day.date} มีกิจกรรม ${dayEvents.length}${taskCount ? ` งาน ${taskCount}` : ""}${reminderCount ? ` เตือน ${reminderCount}` : ""}${petCareCount ? ` ดูแลสัตว์เลี้ยง ${petCareCount}` : ""}${isToday ? " วันนี้" : ""}${isSelected ? " เลือกอยู่" : ""}${financeCount ? ` รายการการเงิน ${financeCount}` : ""}`}
                data-selected={isSelected || undefined}
                className={`min-h-14 rounded-[0.9rem] p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-finance-primary ${isSelected ? "bg-finance-primary text-white shadow-sm" : isToday ? "bg-finance-primary-soft text-finance-primary-strong ring-1 ring-finance-primary" : "text-finance-text hover:bg-finance-primary-soft/60"} ${day.inMonth ? "" : "opacity-35"}`}
              >
                <span className="tabular-nums">
                  {Number(day.date.slice(-2))}
                </span>
                <span className="mt-1 flex gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: event.creatorColor }}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                {taskCount ? (
                  <span className="text-[10px]">✓ {taskCount}</span>
                ) : null}
                {financeCount ? (
                  <span className="text-[10px]">฿ {financeCount}</span>
                ) : null}
                {reminderCount ? (
                  <span className="text-[10px]">◷ {reminderCount}</span>
                ) : null}
                {petCareCount ? (
                  <span className="text-[10px]">♡ {petCareCount}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-finance-text">
          กิจกรรมวันที่ {selected}
        </h2>
        {selectedEvents.length ? (
          selectedEvents.map((event) => (
            <Link key={event.id} href={`/calendar/${event.id}`}>
              <Card className="flex items-start gap-3 rounded-[1.25rem] bg-finance-surface-strong">
                <span
                  className="mt-1 size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: event.creatorColor }}
                />
                <div>
                  <p className="font-medium text-finance-text">{event.title}</p>
                  <p className="text-sm text-finance-muted">
                    {event.is_all_day
                      ? "ทั้งวัน"
                      : formatEventTime(event.starts_at!)}{" "}
                    · {event.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
                  </p>
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="rounded-[1.25rem] bg-finance-surface-strong">
            <p className="text-sm text-finance-muted">ไม่มีกิจกรรมในวันนี้</p>
          </Card>
        )}
        {selectedFinance.map((item) => (
          <Link key={`${item.source}-${item.sourceId}`} href={item.href}>
            <Card className="rounded-[1.25rem] bg-finance-surface-strong">
              <p className="font-medium text-finance-text">{item.title}</p>
              <p className="text-sm text-finance-muted">
                {item.source} · {item.status} ·{" "}
                {item.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
              </p>
            </Card>
          </Link>
        ))}
        {selectedTasks.map((task) => (
          <Card
            key={task.id}
            className="flex items-start gap-3 rounded-[1.25rem] bg-finance-surface-strong"
          >
            <form action={togglePlanTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input
                type="hidden"
                name="completed"
                value={String(!task.is_completed)}
              />
              <button
                type="submit"
                aria-label={
                  task.is_completed
                    ? "ทำเครื่องหมายว่ายังไม่เสร็จ"
                    : "ทำเครื่องหมายว่าเสร็จ"
                }
                className="flex size-8 items-center justify-center rounded-full border border-finance-primary text-finance-primary-strong"
              >
                {task.is_completed ? "✓" : ""}
              </button>
            </form>
            <Link
              className="min-w-0 flex-1"
              href={`/calendar/tasks/${task.id}`}
            >
              <p
                className={`font-medium text-finance-text ${task.is_completed ? "text-finance-muted line-through" : ""}`}
              >
                {task.title}
              </p>
              <p className="text-sm text-finance-muted">
                งาน · {planDateLabel(task.due_date, task.due_time)}
              </p>
            </Link>
          </Card>
        ))}
        {selectedReminders.map((reminder) => (
          <Link key={reminder.id} href={`/calendar/reminders/${reminder.id}`}>
            <Card className="rounded-[1.25rem] bg-finance-surface-strong">
              <p className="font-medium text-finance-text">{reminder.title}</p>
              <p className="text-sm text-finance-muted">
                เตือน · {reminderDateLabel(reminder.reminds_at)}
              </p>
            </Card>
          </Link>
        ))}
        {selectedPetCare.map((record) => (
          <Link key={record.id} href={`/pets/${record.pet_id}`}>
            <Card className="rounded-[1.25rem] bg-finance-surface-strong">
              <p className="font-medium text-finance-text">{record.title}</p>
              <p className="text-sm text-finance-muted">
                {record.pet?.name ?? "สัตว์เลี้ยง"} · {PET_CARE_RECORD_LABEL[record.record_type]} · {petCareDateLabel(record.scheduled_at!)}
              </p>
            </Card>
          </Link>
        ))}
      </section>
    </>
  );
}
