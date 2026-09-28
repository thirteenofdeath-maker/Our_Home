import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
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
import { listChoreWorkspace } from "@/features/chores/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listInventoryItems } from "@/features/inventory/api";
import {
  inventoryQuantityLabel,
  isDateWithinDays,
  isLowStock,
} from "@/features/inventory/types";
import {
  listPlanNotes,
  listPlanReminders,
  listPlanTasks,
} from "@/features/plan/api";
import { NoteForm } from "@/features/plan/components/NoteForm";
import { NoteGrid } from "@/features/plan/components/NoteGrid";
import { PlanTabs, type PlanView } from "@/features/plan/components/PlanTabs";
import { ReminderForm } from "@/features/plan/components/ReminderForm";
import { ReminderList } from "@/features/plan/components/ReminderList";
import { TaskForm } from "@/features/plan/components/TaskForm";
import { TaskList } from "@/features/plan/components/TaskList";
import { listShoppingItems } from "@/features/shopping/api";
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
    chores,
    shopping,
    inventory,
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
    view === "calendar" && household
      ? listChoreWorkspace(supabase, household.id)
      : Promise.resolve({ templates: [], assignees: [], occurrences: [] }),
    view === "calendar" && household
      ? listShoppingItems(supabase, household.id)
      : Promise.resolve([]),
    view === "calendar" && household
      ? listInventoryItems(supabase, household.id)
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
  const choreTemplates = new Map(
    chores.templates.map((template) => [template.id, template]),
  );
  const openChores = chores.occurrences
    .filter((item) => !item.completed_at)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const pendingShopping = shopping.filter((item) => !item.purchased_at);
  const attentionInventory = inventory.filter(
    (item) =>
      isLowStock(item) ||
      isDateWithinDays(item.expiry_date, today, 30) ||
      isDateWithinDays(item.warranty_expires_on, today, 30),
  );

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <section className="app-cover app-cover-calendar light-cover-copy time-cover relative h-48 overflow-hidden rounded-[1.75rem] p-5 shadow-card sm:h-52 sm:p-6">
        <Image
          src="/art/plan-calendar.webp"
          alt="พื้นที่วางแผนที่รวมปฏิทิน งาน รายการเตือน และโน้ต"
          fill
          priority
          sizes="(orientation: landscape) and (min-width: 1024px) calc(100vw - 7rem), (min-width: 700px) calc(100vw - 3rem), 100vw"
          className="app-cover-image time-cover-image object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="time-cover-overlay absolute inset-0"
        />
        <div className="relative max-w-[62%]">
          <p className="text-xs font-medium text-finance-primary-strong">
            สรุปแผนงานวันนี้
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-finance-text">
            แผนงานของเรา
          </h1>
          <p className="mt-1 text-sm text-finance-muted">
            วางแผนให้บ้านเดินหน้าไปด้วยกัน
          </p>
        </div>
        <Link
          href="/calendar/export"
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/85 text-finance-primary-strong shadow-sm backdrop-blur-sm"
          aria-label="ส่งออกปฏิทิน"
        >
          <AppIcon name="transfer" className="size-5 rotate-90" />
        </Link>
        <div className="absolute inset-x-4 bottom-4 grid grid-cols-4 gap-1.5">
          {[
            { value: todayEventCount, label: "กิจกรรม" },
            { value: dueTaskCount, label: "งานค้าง" },
            { value: upcomingReminderCount, label: "เตือน" },
            { value: activeNotes.length, label: "โน้ต" },
          ].map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-[0.9rem] bg-white/80 px-1 py-1.5 text-center backdrop-blur-sm"
            >
              <p className="text-base font-semibold tabular-nums text-finance-text">
                {item.value}
              </p>
              <p className="truncate text-[10px] text-finance-muted">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PlanTabs active={view} />

      {view === "calendar" ? (
        <>
          <section className="flex min-w-0 flex-col gap-3">
            <div>
              <p className="text-sm text-finance-muted">เรื่องที่ต้องจัดการ</p>
              <h2 className="font-semibold text-finance-text">ดูแลบ้าน</h2>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <PlanModuleCard
                title="งานบ้าน"
                href="/chores"
                icon="chores"
                summary={
                  openChores.length
                    ? `เหลือ ${openChores.length} งานที่ยังไม่เสร็จ`
                    : "งานบ้านเรียบร้อยแล้ว"
                }
              >
                {openChores.slice(0, 2).map((chore) => (
                  <PlanModuleItem
                    key={chore.id}
                    href="/chores"
                    label={chore.due_date < today ? "ค้าง" : "งานถัดไป"}
                    title={
                      choreTemplates.get(chore.template_id)?.title ?? "งานบ้าน"
                    }
                    detail={chore.due_date}
                  />
                ))}
                {openChores.length === 0 ? (
                  <PlanModuleEmpty text="ไม่มีงานบ้านค้างอยู่" />
                ) : null}
              </PlanModuleCard>

              <PlanModuleCard
                title="รายการซื้อของ"
                href="/shopping"
                icon="shopping"
                summary={
                  pendingShopping.length
                    ? `รอซื้อ ${pendingShopping.length} รายการ`
                    : "ซื้อครบตามรายการแล้ว"
                }
              >
                {pendingShopping.slice(0, 2).map((item) => (
                  <PlanModuleItem
                    key={item.id}
                    href="/shopping"
                    label="ต้องซื้อ"
                    title={item.name}
                    detail={`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
                  />
                ))}
                {pendingShopping.length === 0 ? (
                  <PlanModuleEmpty text="ยังไม่มีของที่ต้องซื้อ" />
                ) : null}
              </PlanModuleCard>

              <PlanModuleCard
                title="คลังของในบ้าน"
                href="/inventory"
                icon="inventory"
                summary={
                  attentionInventory.length
                    ? `มี ${attentionInventory.length} รายการที่ควรตรวจดู`
                    : `ของในคลัง ${inventory.length} รายการอยู่ในสถานะปกติ`
                }
              >
                {attentionInventory.slice(0, 2).map((item) => (
                  <PlanModuleItem
                    key={item.id}
                    href={`/inventory/${item.id}`}
                    label={isLowStock(item) ? "ใกล้หมด" : "ใกล้กำหนด"}
                    title={item.name}
                    detail={inventoryQuantityLabel(item)}
                  />
                ))}
                {attentionInventory.length === 0 ? (
                  <PlanModuleEmpty text="ยังไม่มีของใกล้หมดหรือใกล้กำหนด" />
                ) : null}
              </PlanModuleCard>
            </div>
          </section>

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
                    ? "bg-finance-primary text-finance-primary-foreground shadow-sm"
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
      <button className="min-h-11 rounded-[1rem] bg-finance-primary px-4 text-sm font-medium text-finance-primary-foreground shadow-sm">
        ค้นหา
      </button>
    </form>
  );
}

function PlanCreateButton({ title, form }: { title: string; form: ReactNode }) {
  return (
    <FormSheetButton
      ariaLabel={title}
      triggerClassName="app-fab fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(79_112_88_/_0.3)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary"
      sheetTitle={title}
      form={form}
      tone="finance"
    >
      <AppIcon name="plus" />
    </FormSheetButton>
  );
}

function PlanModuleCard({
  title,
  href,
  icon,
  summary,
  children,
}: {
  title: string;
  href: string;
  icon: AppIconName;
  summary: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
            <AppIcon name={icon} className="size-5" />
          </span>
          <h3 className="truncate font-semibold text-finance-text">{title}</h3>
        </div>
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-finance-primary-strong"
        >
          ดูทั้งหมด
        </Link>
      </div>
      <p className="mb-3 mt-2 text-sm text-finance-muted">{summary}</p>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </section>
  );
}

function PlanModuleItem({
  href,
  label,
  title,
  detail,
}: {
  href: string;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2 rounded-[1rem] bg-finance-primary-soft/30 px-3 py-2.5 transition-colors hover:bg-finance-primary-soft/55"
    >
      <span className="shrink-0 rounded-full bg-finance-primary-soft px-2 py-0.5 text-[10px] font-medium text-finance-primary-strong">
        {label}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-finance-text">
        {title}
      </p>
      <p className="max-w-[34%] shrink-0 truncate text-xs text-finance-muted">
        {detail}
      </p>
    </Link>
  );
}

function PlanModuleEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-[1rem] bg-finance-primary-soft/30 px-3 py-3 text-sm text-finance-muted">
      {text}
    </p>
  );
}
