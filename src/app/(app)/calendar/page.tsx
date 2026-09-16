import Link from "next/link";
import type { ReactNode } from "react";

import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { listCalendarEvents } from "@/features/calendar/api";
import { AddCalendarEventFab } from "@/features/calendar/components/AddCalendarEventFab";
import { MonthCalendar } from "@/features/calendar/components/MonthCalendar";
import {
  bangkokDateKey,
  monthKey,
  selectedDateForMonth,
  shiftMonth,
  toBangkokInput,
} from "@/features/calendar/domain/calendar";
import { listCalendarFinanceItems } from "@/features/calendar/finance";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  listPlanNotes,
  listPlanReminders,
  listPlanTasks,
} from "@/features/plan/api";
import { NoteForm } from "@/features/plan/components/NoteForm";
import { NoteGrid } from "@/features/plan/components/NoteGrid";
import { PlanSummary } from "@/features/plan/components/PlanSummary";
import { PlanTabs, type PlanView } from "@/features/plan/components/PlanTabs";
import { ReminderForm } from "@/features/plan/components/ReminderForm";
import { ReminderList } from "@/features/plan/components/ReminderList";
import { TaskForm } from "@/features/plan/components/TaskForm";
import { TaskList } from "@/features/plan/components/TaskList";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";
import { listScheduledPetCareRecords } from "@/features/pets/api";

function activeView(value: unknown): PlanView {
  return value === "tasks" || value === "reminders" || value === "notes"
    ? value
    : "calendar";
}

function eventDate(event: {
  is_all_day: boolean;
  all_day_date: string | null;
  starts_at: string | null;
}) {
  return event.is_all_day
    ? event.all_day_date
    : toBangkokInput(event.starts_at).slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const now = new Date();
  const view = activeView(query.view);
  const month = monthKey(
    typeof query.month === "string" ? query.month : undefined,
    now,
  );
  const requested = typeof query.date === "string" ? query.date : undefined;
  const today = bangkokDateKey(now);
  const selected = selectedDateForMonth(month, requested, now);
  const endMonth = shiftMonth(month, 1);
  const search = typeof query.q === "string" ? query.q : "";
  const taskStatus =
    query.status === "done" || query.status === "all" ? query.status : "open";
  const showArchivedNotes = query.archived === "1";

  const [
    events,
    archivedEvents,
    financeItems,
    allTasks,
    allReminders,
    activeNotes,
    archivedNotes,
    petCareRecords,
  ] = await Promise.all([
    listCalendarEvents(supabase, household?.id ?? null, user.id),
    view === "calendar"
      ? listCalendarEvents(supabase, household?.id ?? null, user.id, true)
      : Promise.resolve([]),
    view === "calendar"
      ? listCalendarFinanceItems(supabase, `${month}-01`, `${endMonth}-01`)
      : Promise.resolve([]),
    listPlanTasks(supabase),
    listPlanReminders(supabase),
    listPlanNotes(supabase),
    view === "notes" && showArchivedNotes
      ? listPlanNotes(supabase, { archived: true })
      : Promise.resolve([]),
    view === "calendar" && household
      ? listScheduledPetCareRecords(
          supabase,
          household.id,
          `${month}-01T00:00:00+07:00`,
          `${endMonth}-01T00:00:00+07:00`,
        )
      : Promise.resolve([]),
  ]);

  const normalizedSearch = search.toLocaleLowerCase("th");
  const filteredTasks = allTasks.filter((task) => {
    const matchesSearch =
      !search ||
      [task.title, task.details, task.list_name]
        .filter(Boolean)
        .some((value) =>
          value!.toLocaleLowerCase("th").includes(normalizedSearch),
        );
    const matchesStatus =
      taskStatus === "all" ||
      (taskStatus === "done" ? task.is_completed : !task.is_completed);
    return matchesSearch && matchesStatus;
  });
  const notes = (showArchivedNotes ? archivedNotes : activeNotes).filter(
    (note) =>
      !search ||
      [note.title, note.content]
        .filter(Boolean)
        .some((value) =>
          value!.toLocaleLowerCase("th").includes(normalizedSearch),
        ),
  );
  const todayEventCount = events.filter(
    (event) => eventDate(event) === today,
  ).length;
  const dueTaskCount = allTasks.filter(
    (task) => !task.is_completed && task.due_date && task.due_date <= today,
  ).length;
  const upcomingReminderCount = allReminders.filter(
    (reminder) => !reminder.is_completed,
  ).length;

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PlanTabs active={view} />
      {view !== "calendar" ? (
        <PlanSummary
          today={today}
          eventCount={todayEventCount}
          taskCount={dueTaskCount}
          reminderCount={upcomingReminderCount}
          noteCount={activeNotes.length}
        />
      ) : null}

      {view === "calendar" ? (
        <>
          <AddCalendarEventFab />
          <MonthCalendar
            month={month}
            selected={selected}
            today={today}
            events={events}
            financeItems={financeItems}
            tasks={allTasks}
            reminders={allReminders}
            petCareRecords={petCareRecords}
          />
          {archivedEvents.length ? (
            <section>
              <h2 className="mb-2 font-semibold">กิจกรรมที่เก็บเข้าคลัง</h2>
              <div className="flex flex-col gap-2">
                {archivedEvents.map((event) => (
                  <Link
                    className="text-primary"
                    key={event.id}
                    href={`/calendar/${event.id}`}
                  >
                    {event.title}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {view === "tasks" ? (
        <>
          <PlanCreateButton
            title="เพิ่มงาน"
            form={<TaskForm hasHousehold={Boolean(household)} />}
          />
          <SearchBar view="tasks" defaultValue={search} />
          <nav
            aria-label="สถานะงาน"
            className="flex gap-2 overflow-x-auto rounded-full bg-finance-surface-strong p-1 shadow-sm"
          >
            {[
              { value: "open", label: "ต้องทำ" },
              { value: "done", label: "เสร็จแล้ว" },
              { value: "all", label: "ทั้งหมด" },
            ].map((item) => (
              <Link
                key={item.value}
                href={`/calendar?view=tasks&status=${item.value}`}
                className={cn(
                  "flex min-h-10 flex-1 shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium",
                  taskStatus === item.value
                    ? "bg-finance-primary text-white shadow-sm"
                    : "text-finance-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <TaskList tasks={filteredTasks} />
        </>
      ) : null}

      {view === "reminders" ? (
        <>
          <PlanCreateButton
            title="เพิ่มรายการเตือน"
            form={<ReminderForm hasHousehold={Boolean(household)} />}
          />
          <ReminderList reminders={allReminders} />
        </>
      ) : null}

      {view === "notes" ? (
        <>
          <PlanCreateButton
            title="เพิ่มโน้ต"
            form={<NoteForm hasHousehold={Boolean(household)} />}
          />
          <SearchBar
            view="notes"
            defaultValue={search}
            archived={showArchivedNotes}
          />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-finance-text">
              {showArchivedNotes ? "โน้ตที่เก็บถาวร" : "โน้ตทั้งหมด"}
            </h2>
            <Link
              className="text-sm font-medium text-finance-primary-strong"
              href={
                showArchivedNotes
                  ? "/calendar?view=notes"
                  : "/calendar?view=notes&archived=1"
              }
            >
              {showArchivedNotes ? "กลับไปโน้ต" : "คลังโน้ต"}
            </Link>
          </div>
          <NoteGrid notes={notes} />
        </>
      ) : null}
    </div>
  );
}

function SearchBar({
  view,
  defaultValue,
  archived,
}: {
  view: "tasks" | "notes";
  defaultValue: string;
  archived?: boolean;
}) {
  return (
    <form action="/calendar" className="finance-ui-tone flex gap-2">
      <input type="hidden" name="view" value={view} />
      {archived ? <input type="hidden" name="archived" value="1" /> : null}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={view === "tasks" ? "ค้นหางาน…" : "ค้นหาโน้ต…"}
        className="h-12 min-w-0 flex-1 rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong px-4 text-finance-text shadow-sm outline-none placeholder:text-finance-muted focus:border-finance-primary"
      />
      <button className="min-h-11 rounded-[1rem] bg-finance-primary px-4 text-sm font-medium text-white shadow-sm">
        ค้นหา
      </button>
    </form>
  );
}

function PlanCreateButton({ title, form }: { title: string; form: ReactNode }) {
  return (
    <FormSheetButton
      ariaLabel={title}
      triggerClassName="fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-white shadow-[0_8px_24px_rgb(79_112_88_/_0.3)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary"
      sheetTitle={title}
      form={form}
      tone="finance"
    >
      <AppIcon name="plus" />
    </FormSheetButton>
  );
}
