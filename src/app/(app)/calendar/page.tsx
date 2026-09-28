import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
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
import { listChoreWorkspace, materializeChores } from "@/features/chores/api";
import { toggleChoreTemplateAction } from "@/features/chores/actions";
import { ChoreForm } from "@/features/chores/components/ChoreForm";
import { ChoreOccurrenceCard } from "@/features/chores/components/ChoreOccurrenceCard";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
import { listInventoryItems } from "@/features/inventory/api";
import { InventoryItemCard } from "@/features/inventory/components/InventoryItemCard";
import { InventoryItemForm } from "@/features/inventory/components/InventoryItemForm";
import { isDateWithinDays, isLowStock } from "@/features/inventory/types";
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
import { ShoppingItemCard } from "@/features/shopping/components/ShoppingItemCard";
import { ShoppingItemForm } from "@/features/shopping/components/ShoppingItemForm";
import { requireUser } from "@/lib/auth/require-user";
import { shiftDate } from "@/lib/date/bangkok";
import { cn } from "@/lib/utils/cn";
import { listScheduledPetCareRecords } from "@/features/pets/api";

function activeView(value: unknown): PlanView {
  return value === "tasks" ||
    value === "reminders" ||
    value === "notes" ||
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
  const taskStatus =
    query.status === "done" || query.status === "all" ? query.status : "open";
  const showArchivedNotes = query.archived === "1";

  if (view === "chores" && household && household.myRole !== "observer") {
    await materializeChores(supabase, household.id, shiftDate(today, 14));
  }

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
    members,
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
    household
      ? listChoreWorkspace(supabase, household.id)
      : Promise.resolve({ templates: [], assignees: [], occurrences: [] }),
    household ? listShoppingItems(supabase, household.id) : Promise.resolve([]),
    household
      ? listInventoryItems(supabase, household.id)
      : Promise.resolve([]),
    household && (view === "chores" || view === "shopping")
      ? listHouseholdMembers(supabase, household.id)
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
  const canEditHousehold = Boolean(
    household && household.myRole !== "observer",
  );
  const canManageChores = Boolean(
    household && (household.myRole === "owner" || household.myRole === "admin"),
  );
  const currentMemberId =
    members.find((member) => member.user_id === user.id)?.id ?? null;
  const choreTemplates = new Map(
    chores.templates.map((template) => [template.id, template]),
  );
  const upcomingChores = chores.occurrences
    .filter((item) => !item.completed_at && item.due_date >= today)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const overdueChores = chores.occurrences
    .filter((item) => !item.completed_at && item.due_date < today)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const choreHistory = chores.occurrences
    .filter((item) => item.completed_at)
    .slice(0, 12);
  const purchasedShopping = shopping.filter((item) => item.purchased_at);

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

      <PlanTabs
        active={view}
        householdCounts={{
          chores: openChores.length,
          shopping: pendingShopping.length,
          inventory: attentionInventory.length,
        }}
      />

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
          ) : household.myRole === "observer" ? (
            <ReadOnlyNotice>
              ผู้สังเกตการณ์ดูตารางและประวัติได้ แต่ไม่สามารถเปลี่ยนแปลงงานบ้าน
            </ReadOnlyNotice>
          ) : null}

          <ViewSummary
            icon="chores"
            title="งานบ้าน"
            detail={`เลยกำหนด ${overdueChores.length} · งานถัดไป ${upcomingChores.length}`}
          />

          {overdueChores.length ? (
            <section className="flex flex-col gap-3">
              <SectionHeading
                title="เลยกำหนด"
                count={overdueChores.length}
                danger
              />
              {overdueChores.map((occurrence) => {
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

          <section className="flex flex-col gap-3">
            <SectionHeading
              title="งานถัดไป"
              count={upcomingChores.length}
              suffix="14 วัน"
            />
            {upcomingChores.length ? (
              upcomingChores.map((occurrence) => {
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
              })
            ) : (
              <Card className="rounded-[1.35rem] bg-finance-surface-strong text-center text-sm text-finance-muted">
                ยังไม่มีตารางงานบ้าน กด + เพื่อเริ่มจัดงาน
              </Card>
            )}
          </section>

          {canManageChores && chores.templates.length ? (
            <section className="flex flex-col gap-3">
              <SectionHeading
                title="ตารางหมุนเวียน"
                count={chores.templates.length}
              />
              {chores.templates.map((template) => {
                const templateAssignees = chores.assignees.filter(
                  (item) => item.template_id === template.id,
                );
                return (
                  <Card
                    key={template.id}
                    className="flex items-center justify-between gap-3 rounded-[1.35rem] bg-finance-surface-strong"
                  >
                    <div>
                      <h3 className="font-semibold text-finance-text">
                        {template.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-finance-muted">
                        {template.cadence === "DAILY" ? "ทุกวัน" : "ทุกสัปดาห์"}{" "}
                        · {templateAssignees.length} คน
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <FormSheetButton
                        ariaLabel={`แก้ไข ${template.title}`}
                        triggerClassName="rounded-full border border-finance-primary-soft bg-finance-surface-strong px-3 py-2 text-sm font-medium text-finance-primary-strong"
                        sheetTitle="แก้ไขตารางงานบ้าน"
                        form={
                          <ChoreForm
                            householdId={household.id}
                            today={today}
                            members={members.map((member) => ({
                              id: member.id,
                              label:
                                member.profile?.display_name ??
                                member.profile?.email ??
                                "สมาชิก",
                            }))}
                            template={template}
                            selectedMemberIds={templateAssignees.map(
                              (item) => item.member_id,
                            )}
                          />
                        }
                        tone="finance"
                      >
                        แก้ไข
                      </FormSheetButton>
                      <form action={toggleChoreTemplateAction}>
                        <input
                          type="hidden"
                          name="templateId"
                          value={template.id}
                        />
                        <input
                          type="hidden"
                          name="active"
                          value={String(!template.is_active)}
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-finance-primary-soft px-3 py-2 text-sm font-medium text-finance-primary-strong"
                        >
                          {template.is_active ? "พักตาราง" : "เปิดตาราง"}
                        </button>
                      </form>
                    </div>
                  </Card>
                );
              })}
            </section>
          ) : null}

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

          <ViewSummary
            icon="shopping"
            title="รายการซื้อของ"
            detail={`ต้องซื้อ ${pendingShopping.length} · ซื้อแล้ว ${purchasedShopping.length}`}
          />

          <section className="flex flex-col gap-3">
            <SectionHeading title="ต้องซื้อ" count={pendingShopping.length} />
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
                ซื้อครบแล้ว บ้านพร้อมมาก 🎉
              </Card>
            )}
          </section>

          {purchasedShopping.length ? (
            <section className="flex flex-col gap-3">
              <SectionHeading
                title="ซื้อแล้ว"
                count={purchasedShopping.length}
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

          <ViewSummary
            icon="inventory"
            title="คลังของในบ้าน"
            detail={`ทั้งหมด ${inventory.length} · ควรดูแล ${attentionInventory.length}`}
          />

          <section className="flex flex-col gap-3">
            <SectionHeading title="รายการทั้งหมด" count={inventory.length} />
            {inventory.length ? (
              inventory.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  canEdit={canEditHousehold}
                  today={today}
                />
              ))
            ) : (
              <Card className="rounded-[1.35rem] bg-finance-surface-strong text-center text-sm text-finance-muted">
                ยังไม่มีของในคลัง กด + เพื่อเริ่มบันทึก
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function ViewSummary({
  icon,
  title,
  detail,
}: {
  icon: "chores" | "shopping" | "inventory";
  title: string;
  detail: string;
}) {
  return (
    <section className="flex items-center gap-3 rounded-[1.35rem] bg-finance-primary-soft/45 p-4 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-finance-surface-strong text-finance-primary-strong">
        <AppIcon name={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold text-finance-text">{title}</h2>
        <p className="mt-0.5 text-sm text-finance-muted">{detail}</p>
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  count,
  suffix,
  danger = false,
}: {
  title: string;
  count: number;
  suffix?: string;
  danger?: boolean;
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
      <span className="text-sm text-finance-muted">
        {count} รายการ{suffix ? ` · ${suffix}` : ""}
      </span>
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
