import { PageNavigation } from "@/components/ui/PageNavigation";
import { getWorkspaceSummary } from "@/features/plan/workspace-summary";
import { ActionForm } from "@/components/ui/ActionForm";
import Link from "next/link";
import { PlanHeader } from "@/features/plan/components/PlanHeader";
import type { ReactNode } from "react";

import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { APP_FAB_CLASSNAME } from "@/components/ui/fab";
import { listCalendarEvents } from "@/features/calendar/api";
import { AddCalendarEventFab } from "@/features/calendar/components/AddCalendarEventFab";
import { MonthCalendar } from "@/features/calendar/components/MonthCalendar";
import {
  bangkokDateKey,
  monthKey,
  monthDays,
  selectedDateForMonth,
  shiftMonth,
  toBangkokInput,
} from "@/features/calendar/domain/calendar";
import {
  countOverdueChores,
  countCompletedChores,
  listChoreWorkspace,
  materializeChores,
} from "@/features/chores/api";
import { toggleChoreTemplateAction } from "@/features/chores/actions";
import { ChoreForm } from "@/features/chores/components/ChoreForm";
import { DeleteChoreTemplateButton } from "@/features/chores/components/DeleteChoreTemplateButton";
import { ClearOverdueChoresButton } from "@/features/chores/components/ClearOverdueChoresButton";
import { ChoreOccurrenceCard } from "@/features/chores/components/ChoreOccurrenceCard";
import {
  choreDayHeading,
  choreFullDate,
  groupChoresByDate,
} from "@/features/chores/schedule";
import { choreCadenceLabel, type ChoreTemplate } from "@/features/chores/types";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
import { listInventoryItems } from "@/features/inventory/api";
import { InventoryItemCard } from "@/features/inventory/components/InventoryItemCard";
import { InventoryItemForm } from "@/features/inventory/components/InventoryItemForm";
import {
  groupInventoryByCategory,
  INVENTORY_CATEGORY_LABEL,
  isLowStock,
} from "@/features/inventory/types";
import { listPlanReminders, listPlanTasks } from "@/features/plan/api";
import { PlanTabs, type PlanView } from "@/features/plan/components/PlanTabs";
import { ReminderForm } from "@/features/plan/components/ReminderForm";
import { ReminderList } from "@/features/plan/components/ReminderList";
import { TaskForm } from "@/features/plan/components/TaskForm";
import { TaskList } from "@/features/plan/components/TaskList";
import { listShoppingItems } from "@/features/shopping/api";
import { ShoppingItemCard } from "@/features/shopping/components/ShoppingItemCard";
import { ShoppingItemForm } from "@/features/shopping/components/ShoppingItemForm";
import { requireUser } from "@/lib/auth/require-user";
import { shiftDate } from "@/lib/date/bangkok";
import { cn } from "@/lib/utils/cn";
import { listScheduledPetCareRecords } from "@/features/pets/api";
import type { InventoryCategory } from "@/types/database";

const INVENTORY_CATEGORY_ICON: Record<InventoryCategory, AppIconName> = {
  PET_SUPPLY: "pets",
  HOUSEHOLD: "household",
  FOOD: "shopping",
  MEDICINE: "plus",
  WARRANTY: "info",
  OTHER: "inventory",
};

function activeView(value: unknown): PlanView {
  return value === "tasks" ||
    value === "reminders" ||
    value === "chores" ||
    value === "shopping" ||
    value === "inventory"
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
  const page = Math.min(
    100000,
    Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1),
  );
  const pageSize = 30;
  const pageRequest = { offset: (page - 1) * pageSize, size: pageSize + 1 };
  const gridDays = monthDays(month);
  const calendarWindow = {
    from: gridDays[0].date,
    to: shiftDate(gridDays[gridDays.length - 1].date, 1),
  };
  const taskStatus =
    query.status === "done" || query.status === "all" ? query.status : "open";
  const choresPromise =
    household && view === "chores"
      ? (async () => {
          if (household.myRole !== "observer") {
            await materializeChores(
              supabase,
              household.id,
              shiftDate(today, 14),
            );
          }
          return listChoreWorkspace(supabase, household.id, pageRequest);
        })()
      : Promise.resolve({ templates: [], assignees: [], occurrences: [] });

  const [
    events,
    archivedEvents,
    allTasks,
    allReminders,
    petCareRecords,
    chores,
    shopping,
    inventory,
    members,
    summary,
  ] = await Promise.all([
    view === "calendar"
      ? listCalendarEvents(
          supabase,
          household?.id ?? null,
          user.id,
          false,
          calendarWindow,
        )
      : Promise.resolve([]),
    view === "calendar"
      ? listCalendarEvents(
          supabase,
          household?.id ?? null,
          user.id,
          true,
          calendarWindow,
        )
      : Promise.resolve([]),
    view === "calendar" || view === "tasks"
      ? listPlanTasks(
          supabase,
          view === "calendar"
            ? calendarWindow
            : {
                query: search,
                completed:
                  taskStatus === "all" ? undefined : taskStatus === "done",
                page: pageRequest,
              },
        )
      : Promise.resolve([]),
    view === "calendar" || view === "reminders"
      ? listPlanReminders(
          supabase,
          view === "calendar" ? calendarWindow : { page: pageRequest },
        )
      : Promise.resolve([]),
    view === "calendar" && household
      ? listScheduledPetCareRecords(
          supabase,
          household.id,
          `${month}-01T00:00:00+07:00`,
          `${endMonth}-01T00:00:00+07:00`,
        )
      : Promise.resolve([]),
    choresPromise,
    household && view === "shopping"
      ? listShoppingItems(supabase, household.id, pageRequest)
      : Promise.resolve([]),
    household && view === "inventory"
      ? listInventoryItems(supabase, household.id, pageRequest)
      : Promise.resolve([]),
    household && (view === "chores" || view === "shopping")
      ? listHouseholdMembers(supabase, household.id)
      : Promise.resolve([]),
    getWorkspaceSummary(supabase, household?.id ?? null, today),
  ]);

  const pagedItems =
    view === "tasks"
      ? allTasks
      : view === "reminders"
        ? allReminders
        : view === "shopping"
          ? shopping
          : view === "inventory"
            ? inventory
            : null;
  const hasNext = Boolean(pagedItems && pagedItems.length > pageSize);
  if (pagedItems && hasNext) pagedItems.pop();

  const overdueChoreCount =
    household && view === "chores"
      ? await countOverdueChores(supabase, household.id, today)
      : 0;

  const filteredTasks = allTasks;
  const todayEventCount = events.filter(
    (event) => eventDate(event) === today,
  ).length;
  const pendingShopping = shopping.filter((item) => !item.purchased_at);
  const inventoryGroups = groupInventoryByCategory(inventory);
  const canEditHousehold = Boolean(
    household && household.myRole !== "observer",
  );
  const canManageChores = Boolean(
    household && (household.myRole === "owner" || household.myRole === "admin"),
  );
  const currentMemberId =
    members.find((member) => member.user_id === user.id)?.id ?? null;
  const choreFormMembers = members.map((member) => ({
    id: member.id,
    label: member.profile?.display_name ?? member.profile?.email ?? "สมาชิก",
  }));
  const choreTemplates = new Map(
    chores.templates.map((template) => [template.id, template]),
  );
  const upcomingChores = chores.occurrences
    .filter((item) => !item.completed_at && item.due_date >= today)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const overdueChores = chores.occurrences
    .filter((item) => !item.completed_at && item.due_date < today)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const upcomingChoreGroups = groupChoresByDate(upcomingChores);
  const hasMoreOverdue = overdueChores.length > pageSize;
  const overdueChoreGroups = groupChoresByDate(
    overdueChores.slice(0, pageSize),
  );
  const choreHistory = chores.occurrences
    .filter((item) => item.completed_at)
    .toSorted((a, b) => b.completed_at!.localeCompare(a.completed_at!))
    .slice(0, 12);
  const purchasedShopping = shopping.filter((item) => item.purchased_at);
  const todayChores = chores.occurrences.filter(
    (item) => item.due_date === today,
  );
  const completedChoreCount =
    household && view === "chores"
      ? await countCompletedChores(supabase, household.id)
      : 0;
  const shoppingBudget =
    summary.shopping.currencies === 1
      ? new Intl.NumberFormat("th-TH", {
          style: "currency",
          currency: summary.shopping.currency ?? "THB",
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(Number(summary.shopping.budget ?? 0))
      : summary.shopping.currencies > 1
        ? "หลายสกุล"
        : "—";
  const taskProgress = summary.tasks.total
    ? `${Math.round((summary.tasks.done / summary.tasks.total) * 100)}%`
    : "0%";
  const cover = {
    calendar: {
      eyebrow: "สรุปแผนงานวันนี้",
      title: "แผนงานของเรา",
      subtitle: "วางแผนให้บ้านเดินหน้าไปด้วยกัน",
      metrics: [
        { value: todayEventCount, label: "กิจกรรม" },
        { value: summary.tasks.today, label: "งานวันนี้" },
        { value: summary.reminders.today, label: "เตือนวันนี้" },
      ],
    },
    tasks: {
      eyebrow: "ติดตามสิ่งที่ต้องทำ",
      title: "งานของเรา",
      subtitle: "เห็นงานสำคัญและความคืบหน้าในที่เดียว",
      metrics: [
        { value: summary.tasks.today, label: "วันนี้" },
        { value: summary.tasks.overdue, label: "งานค้าง" },
        { value: summary.tasks.done, label: "เสร็จแล้ว" },
        { value: taskProgress, label: "ความคืบหน้า" },
      ],
    },
    reminders: {
      eyebrow: "ไม่พลาดเรื่องสำคัญ",
      title: "รายการเตือน",
      subtitle: "เตรียมพร้อมก่อนทุกกำหนดหมาย",
      metrics: [
        { value: summary.reminders.today, label: "วันนี้" },
        { value: summary.reminders.upcoming, label: "ใกล้ถึง" },
        { value: summary.reminders.overdue, label: "เลยกำหนด" },
        { value: summary.reminders.done, label: "เสร็จแล้ว" },
      ],
    },
    chores: {
      eyebrow: "ดูแลงานในบ้าน",
      title: "งานบ้านของเรา",
      subtitle: "แบ่งกันทำ บ้านก็เบาขึ้น",
      metrics: [
        { value: todayChores.length, label: "วันนี้" },
        { value: overdueChoreCount, label: "เลยกำหนด" },
        { value: upcomingChores.length, label: "14 วัน" },
        { value: completedChoreCount, label: "เสร็จแล้ว" },
      ],
    },
    shopping: {
      eyebrow: "ของที่บ้านต้องใช้",
      title: "รายการซื้อของ",
      subtitle: "ซื้อด้วยกัน ไม่ลืมกัน",
      metrics: [
        { value: summary.shopping.pending, label: "ต้องซื้อ" },
        { value: summary.shopping.purchased, label: "ซื้อแล้ว" },
        { value: shoppingBudget, label: "งบประมาณ" },
        { value: summary.shopping.assigned, label: "ผู้รับผิดชอบ" },
      ],
    },
    inventory: {
      eyebrow: "ของที่บ้านมีอยู่",
      title: "คลังของในบ้าน",
      subtitle: "รู้ก่อนหมด ไม่ซื้อซ้ำ",
      metrics: [
        { value: summary.inventory.total, label: "ทั้งหมด" },
        { value: summary.inventory.low, label: "ใกล้หมด" },
        { value: summary.inventory.expiry, label: "ใกล้หมดอายุ" },
        { value: summary.inventory.warranty, label: "ใกล้หมดประกัน" },
      ],
    },
  } satisfies Record<
    PlanView,
    {
      eyebrow: string;
      title: string;
      subtitle: string;
      metrics: Array<{ value: number | string; label: string }>;
    }
  >;
  const activeCover = cover[view];

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PlanHeader
        {...activeCover}
        rightAction={
          view === "calendar" ? (
            <Link
              href="/calendar/export"
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/85 text-finance-primary-strong shadow-sm backdrop-blur-sm"
              aria-label="ส่งออกปฏิทิน"
            >
              <AppIcon name="transfer" className="size-5 rotate-90" />
            </Link>
          ) : null
        }
      />

      <PlanTabs active={view} />
      <div key={view} className="plan-content-transition contents">
        {view === "calendar" ? (
          <>
            <AddCalendarEventFab />
            <MonthCalendar
              month={month}
              selected={selected}
              today={today}
              events={events}
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

        {(view === "chores" || view === "shopping" || view === "inventory") &&
        !household ? (
          <Card className="rounded-[1.5rem] bg-finance-surface-strong text-center">
            <p className="font-medium text-finance-text">
              สร้างบ้านก่อนเริ่มจัดการเรื่องภายในบ้านร่วมกัน
            </p>
            <Link
              className="mt-3 inline-block text-sm font-medium text-finance-primary-strong"
              href="/household/new"
            >
              สร้างบ้าน
            </Link>
          </Card>
        ) : null}

        {view === "chores" && household ? (
          <>
            {canManageChores ? (
              <PlanCreateButton
                title="เพิ่มตารางงานบ้าน"
                form={
                  <ChoreForm
                    householdId={household.id}
                    today={today}
                    members={choreFormMembers}
                  />
                }
              />
            ) : household.myRole === "observer" ? (
              <ReadOnlyNotice>
                ผู้สังเกตการณ์ดูตารางและประวัติได้
                แต่ไม่สามารถเปลี่ยนแปลงงานบ้าน
              </ReadOnlyNotice>
            ) : null}

            {canManageChores && chores.templates.length ? (
              <details className="group overflow-hidden rounded-[1.5rem] bg-finance-surface-strong shadow-sm">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-finance-text [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      จัดการตารางหมุนเวียน
                    </span>
                    <span className="block text-xs text-finance-muted">
                      แก้ไขรอบงานและลำดับผู้รับผิดชอบ
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-finance-primary-soft px-2.5 py-1 text-xs font-semibold text-finance-primary-strong">
                      {chores.templates.length} ตาราง
                    </span>
                    <AppIcon
                      name="chevron"
                      className="size-4 text-finance-muted transition-transform group-open:rotate-90"
                    />
                  </span>
                </summary>
                <div className="max-h-[min(50dvh,28rem)] space-y-2 overflow-y-auto border-t border-finance-primary-soft bg-finance-background/70 p-3">
                  {chores.templates.map((template) => (
                    <ChoreTemplateManagerCard
                      key={template.id}
                      template={template}
                      householdId={household.id}
                      today={today}
                      members={choreFormMembers}
                      selectedMemberIds={chores.assignees
                        .filter((item) => item.template_id === template.id)
                        .map((item) => item.member_id)}
                    />
                  ))}
                </div>
              </details>
            ) : null}

            {overdueChoreCount > 0 ? (
              <section className="flex flex-col gap-3">
                <SectionHeading
                  title="เลยกำหนด"
                  count={overdueChoreCount}
                  danger
                  action={
                    canManageChores ? (
                      <ClearOverdueChoresButton
                        householdId={household.id}
                        beforeDate={today}
                        count={overdueChoreCount}
                      />
                    ) : null
                  }
                />
                {overdueChoreGroups.map((group) => (
                  <ChoreDayGroupHeader
                    key={group.date}
                    date={group.date}
                    today={today}
                    count={group.chores.length}
                    danger
                  >
                    {group.chores.map((occurrence) => {
                      const template = choreTemplates.get(
                        occurrence.template_id,
                      );
                      return template ? (
                        <ChoreOccurrenceCard
                          key={occurrence.id}
                          occurrence={occurrence}
                          template={template}
                          members={members}
                          currentMemberId={currentMemberId}
                          canParticipate={canEditHousehold}
                          showDate={false}
                        />
                      ) : null;
                    })}
                  </ChoreDayGroupHeader>
                ))}
              </section>
            ) : null}

            <section className="flex flex-col gap-3">
              <SectionHeading
                title="งานถัดไป"
                count={upcomingChores.length}
                suffix="14 วัน"
              />
              {upcomingChores.length ? (
                upcomingChoreGroups.map((group) => (
                  <ChoreDayGroupHeader
                    key={group.date}
                    date={group.date}
                    today={today}
                    count={group.chores.length}
                  >
                    {group.chores.map((occurrence) => {
                      const template = choreTemplates.get(
                        occurrence.template_id,
                      );
                      return template ? (
                        <ChoreOccurrenceCard
                          key={occurrence.id}
                          occurrence={occurrence}
                          template={template}
                          members={members}
                          currentMemberId={currentMemberId}
                          canParticipate={canEditHousehold}
                          showDate={false}
                        />
                      ) : null;
                    })}
                  </ChoreDayGroupHeader>
                ))
              ) : (
                <Card className="rounded-[1.35rem] bg-finance-surface-strong text-center text-sm text-finance-muted">
                  ยังไม่มีตารางงานบ้าน กด + เพื่อเริ่มจัดงาน
                </Card>
              )}
            </section>

            {choreHistory.length ? (
              <section className="flex flex-col gap-3">
                <SectionHeading
                  title="ประวัติล่าสุด"
                  count={choreHistory.length}
                />
                {choreHistory.map((occurrence) => {
                  const template = choreTemplates.get(occurrence.template_id);
                  return template ? (
                    <ChoreOccurrenceCard
                      key={occurrence.id}
                      occurrence={occurrence}
                      template={template}
                      members={members}
                      currentMemberId={currentMemberId}
                      canParticipate={canEditHousehold}
                    />
                  ) : null;
                })}
              </section>
            ) : null}
          </>
        ) : null}

        {view === "shopping" && household ? (
          <>
            {canEditHousehold ? (
              <form id="shopping-receipt" action="/calendar/shopping/expense">
                <button className="rounded-xl bg-finance-primary px-4 py-2 text-sm font-medium text-finance-primary-foreground">
                  ลงบิลรายการที่เลือก
                </button>
              </form>
            ) : null}
            {canEditHousehold ? (
              <PlanCreateButton
                title="เพิ่มของที่ต้องซื้อ"
                form={
                  <ShoppingItemForm
                    householdId={household.id}
                    members={members.map((member) => ({
                      id: member.id,
                      label:
                        member.profile?.display_name ??
                        member.profile?.email ??
                        "สมาชิก",
                    }))}
                  />
                }
              />
            ) : (
              <ReadOnlyNotice>
                ผู้สังเกตการณ์ดูรายการได้ แต่ไม่สามารถเพิ่มหรือเปลี่ยนแปลงรายการ
              </ReadOnlyNotice>
            )}

            <section className="flex flex-col gap-3">
              <SectionHeading
                title="ต้องซื้อ"
                count={summary.shopping.pending}
              />
              {pendingShopping.length ? (
                pendingShopping.map((item) => (
                  <ShoppingItemCard
                    key={item.id}
                    item={item}
                    members={members}
                    canEdit={canEditHousehold}
                  />
                ))
              ) : (
                <Card className="rounded-[1.35rem] bg-finance-surface-strong text-center text-sm text-finance-muted">
                  {summary.shopping.pending
                    ? "ไม่มีรายการต้องซื้อในหน้านี้"
                    : "ซื้อครบแล้ว บ้านพร้อมมาก 🎉"}
                </Card>
              )}
            </section>

            {purchasedShopping.length ? (
              <section className="flex flex-col gap-3">
                <SectionHeading
                  title="ซื้อแล้ว"
                  count={summary.shopping.purchased}
                />
                {purchasedShopping.map((item) => (
                  <ShoppingItemCard
                    key={item.id}
                    item={item}
                    members={members}
                    canEdit={canEditHousehold}
                  />
                ))}
              </section>
            ) : null}
          </>
        ) : null}

        {view === "inventory" && household ? (
          <>
            {canEditHousehold ? (
              <PlanCreateButton
                title="เพิ่มของในคลัง"
                form={<InventoryItemForm householdId={household.id} />}
              />
            ) : (
              <ReadOnlyNotice>
                ผู้สังเกตการณ์ดูคลังได้ แต่ไม่สามารถเปลี่ยนแปลงข้อมูล
              </ReadOnlyNotice>
            )}

            <section className="flex flex-col gap-4">
              <SectionHeading
                title="รายการตามหมวดหมู่"
                count={summary.inventory.total}
              />
              {inventory.length ? (
                inventoryGroups.map(({ category, items }) => {
                  const lowStockCount = items.filter(isLowStock).length;
                  return (
                    <details
                      key={category}
                      className="group overflow-hidden rounded-[1.35rem] bg-finance-surface-strong shadow-card"
                    >
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 marker:hidden">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
                          <AppIcon
                            name={INVENTORY_CATEGORY_ICON[category]}
                            className="size-4.5"
                          />
                        </span>
                        <h3 className="font-semibold text-finance-text">
                          {INVENTORY_CATEGORY_LABEL[category]}
                        </h3>
                        {lowStockCount ? (
                          <span className="rounded-full bg-[#fce5db] px-2 py-0.5 text-xs font-medium text-[#a9513d]">
                            ควรเติม {lowStockCount}
                          </span>
                        ) : null}
                        <span className="ml-auto text-sm tabular-nums text-finance-muted">
                          {items.length} รายการ
                        </span>
                        <AppIcon
                          name="chevron"
                          className="size-4 shrink-0 text-finance-muted transition-transform group-open:rotate-90"
                        />
                      </summary>
                      <div className="flex flex-col gap-2.5 border-t border-border/60 bg-finance-primary-soft/25 p-2.5">
                        {items.map((item) => (
                          <InventoryItemCard
                            key={item.id}
                            item={item}
                            canEdit={canEditHousehold}
                            today={today}
                            showCategory={false}
                          />
                        ))}
                      </div>
                    </details>
                  );
                })
              ) : (
                <Card className="rounded-[1.35rem] bg-finance-surface-strong text-center text-sm text-finance-muted">
                  ยังไม่มีของในคลัง กด + เพื่อเริ่มบันทึก
                </Card>
              )}
            </section>
          </>
        ) : null}
        {view === "chores" ? (
          <PageNavigation page={page} hasNext={hasMoreOverdue} query={query} />
        ) : null}
        {pagedItems ? (
          <PageNavigation page={page} hasNext={hasNext} query={query} />
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  count,
  suffix,
  danger = false,
  action,
}: {
  title: string;
  count: number;
  suffix?: string;
  danger?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        className={cn(
          "font-semibold text-finance-text",
          danger && "text-danger",
        )}
      >
        {title}
      </h2>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-finance-muted">
          {count} รายการ{suffix ? ` · ${suffix}` : ""}
        </span>
        {action}
      </div>
    </div>
  );
}

function ChoreDayGroupHeader({
  date,
  today,
  count,
  danger = false,
  children,
}: {
  date: string;
  today: string;
  count: number;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-l-2 border-finance-primary-soft pl-3">
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-[1.15rem] bg-finance-primary-soft/70 px-4 py-3",
          danger && "border border-danger/20 bg-danger/10",
        )}
      >
        <div>
          <h3
            className={cn(
              "font-semibold text-finance-text",
              danger && "text-danger",
            )}
          >
            {choreDayHeading(date, today)}
          </h3>
          <p className="text-xs text-finance-muted">{choreFullDate(date)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-finance-surface-strong px-3 py-1 text-xs font-medium text-finance-text shadow-sm">
          {count} งาน
        </span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function ReadOnlyNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[1rem] bg-finance-primary-soft/60 px-4 py-3 text-sm text-finance-muted">
      {children}
    </p>
  );
}

function ChoreTemplateManagerCard({
  template,
  householdId,
  today,
  members,
  selectedMemberIds,
}: {
  template: ChoreTemplate;
  householdId: string;
  today: string;
  members: Array<{ id: string; label: string }>;
  selectedMemberIds: string[];
}) {
  return (
    <Card className="flex items-center justify-between gap-2 rounded-[1rem] border border-border/70 bg-finance-surface-strong p-3 shadow-sm">
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-finance-text">
          {template.title}
        </h3>
        <p className="mt-0.5 truncate text-sm text-finance-muted">
          {choreCadenceLabel(
            template.cadence,
            template.interval_count,
            template.starts_on,
          )}{" "}
          · {selectedMemberIds.length} คน
          {!template.is_active ? " · พักอยู่" : ""}
        </p>
      </div>
      <details className="group/menu relative shrink-0">
        <summary
          className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full border border-finance-primary/25 bg-finance-primary-soft text-finance-primary-strong marker:hidden shadow-sm [&::-webkit-details-marker]:hidden"
          aria-label={`จัดการตาราง ${template.title}`}
        >
          <AppIcon name="more" className="size-5" strokeWidth={2.8} />
        </summary>
        <div className="absolute right-0 top-11 z-10 flex min-w-40 flex-col overflow-hidden rounded-[1rem] bg-finance-surface-strong p-1.5 text-sm font-medium shadow-card ring-1 ring-border/70">
          <FormSheetButton
            ariaLabel={`แก้ไข ${template.title}`}
            triggerClassName="rounded-[0.75rem] px-3 py-2 text-left text-finance-primary-strong"
            sheetTitle="แก้ไขตารางงานบ้าน"
            form={
              <ChoreForm
                householdId={householdId}
                today={today}
                members={members}
                template={template}
                selectedMemberIds={selectedMemberIds}
              />
            }
            tone="finance"
          >
            แก้ไข
          </FormSheetButton>
          <ActionForm action={toggleChoreTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <input
              type="hidden"
              name="active"
              value={String(!template.is_active)}
            />
            <button
              type="submit"
              className="w-full rounded-[0.75rem] px-3 py-2 text-left text-finance-muted"
            >
              {template.is_active ? "พักตาราง" : "เปิดตาราง"}
            </button>
          </ActionForm>
          <DeleteChoreTemplateButton
            templateId={template.id}
            title={template.title}
          />
        </div>
      </details>
    </Card>
  );
}

function SearchBar({
  view,
  defaultValue,
}: {
  view: "tasks";
  defaultValue: string;
}) {
  return (
    <form action="/calendar" className="finance-ui-tone flex gap-2">
      <input type="hidden" name="view" value={view} />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="ค้นหางาน…"
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
      triggerClassName={APP_FAB_CLASSNAME}
      sheetTitle={title}
      form={form}
      tone="finance"
    >
      <AppIcon name="plus" />
    </FormSheetButton>
  );
}
