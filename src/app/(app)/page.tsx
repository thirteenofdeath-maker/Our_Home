import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { listCalendarEvents } from "@/features/calendar/api";
import {
  bangkokDateKey,
  formatEventTime,
  toBangkokInput,
} from "@/features/calendar/domain/calendar";
import { listCalendarFinanceItems } from "@/features/calendar/finance";
import { listChoreWorkspace } from "@/features/chores/api";
import {
  getFinanceSummary,
  listRecentFinanceTransactions,
} from "@/features/finance/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listInventoryItems } from "@/features/inventory/api";
import {
  inventoryQuantityLabel,
  isDateWithinDays,
  isLowStock,
} from "@/features/inventory/types";
import { getCurrentProfile } from "@/features/profile/api";
import {
  listPetSummaries,
  listRecentHouseholdPetCareRecords,
  listScheduledPetCareRecords,
} from "@/features/pets/api";
import {
  PET_CARE_RECORD_LABEL,
  petCareDateLabel,
} from "@/features/pets/domain/care-record";
import { listPlanReminders, listPlanTasks } from "@/features/plan/api";
import { planDateLabel, reminderDateLabel } from "@/features/plan/domain";
import { listShoppingItems } from "@/features/shopping/api";
import { listMyWallets } from "@/features/wallets/api";
import {
  greetingForBangkok,
  homeCoverMode,
  type HomeCoverMode,
} from "@/features/today/domain";
import { parseTimeTheme } from "@/features/theme/time-theme";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
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

function thaiToday(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function weekDates(date: string) {
  const current = new Date(`${date}T00:00:00Z`);
  const start = new Date(current);
  start.setUTCDate(current.getUTCDate() - current.getUTCDay());
  return new Array<string>(7).fill("").map((_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

const HOME_COVER_STYLES: Record<
  HomeCoverMode,
  {
    src: string;
    alt: string;
  }
> = {
  birthday: {
    src: "/art/home-birthday.webp",
    alt: "พ่อแม่และลูกสาวฉลองวันเกิดที่บ้านกับแมวสี่ตัวและกระต่าย",
  },
  morning: {
    src: "/art/home-morning.webp",
    alt: "ยามเช้าที่พ่อแม่และลูกสาวเริ่มต้นวันพร้อมแมวสี่ตัวและกระต่าย",
  },
  "late-morning": {
    src: "/art/home-late-morning.webp",
    alt: "ช่วงสายที่พ่อแม่และลูกสาวช่วยกันทำงานบ้านพร้อมสัตว์เลี้ยง",
  },
  midday: {
    src: "/art/home-midday.webp",
    alt: "ตอนเที่ยงที่พ่อแม่และลูกสาวเตรียมอาหารพร้อมสัตว์เลี้ยง",
  },
  afternoon: {
    src: "/art/home-afternoon.webp",
    alt: "ยามบ่ายที่พ่อแม่และลูกสาวทำกิจกรรมพร้อมแมวสี่ตัวและกระต่าย",
  },
  evening: {
    src: "/art/home-evening.webp",
    alt: "ยามเย็นที่พ่อกลับบ้านและครอบครัวเตรียมอาหารพร้อมสัตว์เลี้ยง",
  },
  night: {
    src: "/art/home-night.webp",
    alt: "ตอนค่ำที่พ่อแม่อ่านนิทานให้ลูกสาวพร้อมแมวสี่ตัวและกระต่าย",
  },
  "late-night": {
    src: "/art/home-late-night.webp",
    alt: "ยามดึกที่พ่อแม่ ลูกสาว แมวสี่ตัว และกระต่ายนอนหลับพักผ่อน",
  },
};

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { supabase, user } = await requireUser();
  const now = new Date();
  const themeOverride = parseTimeTheme((await searchParams).timeTheme);

  const walletsPromise = listMyWallets(supabase);
  const householdPromise = getMyPrimaryHousehold(supabase, user.id);
  const profilePromise = getCurrentProfile(supabase, user.id);
  const [wallets, household] = await Promise.all([
    walletsPromise,
    householdPromise,
  ]);

  if (wallets.length === 0 && !household) {
    redirect("/onboarding");
  }

  const today = bangkokDateKey(now);
  const tomorrow = shiftDate(today, 1);
  const upcomingEnd = shiftDate(today, 8);
  const householdId = household?.id ?? null;

  const eventsPromise = listCalendarEvents(supabase, householdId, user.id);
  const tasksPromise = listPlanTasks(supabase);
  const remindersPromise = listPlanReminders(supabase, { completed: false });
  const dueFinancePromise = listCalendarFinanceItems(
    supabase,
    today,
    upcomingEnd,
  );
  const financePromise = getFinanceSummary(supabase, {
    start: `${today}T00:00:00+07:00`,
    end: `${tomorrow}T00:00:00+07:00`,
  });
  const recentTransactionsPromise = listRecentFinanceTransactions(supabase, {
    limit: 5,
  });
  const petsPromise: ReturnType<typeof listPetSummaries> = householdId
    ? listPetSummaries(supabase, householdId)
    : Promise.resolve([]);
  const petCarePromise: ReturnType<typeof listScheduledPetCareRecords> =
    householdId
      ? listScheduledPetCareRecords(
          supabase,
          householdId,
          `${today}T00:00:00+07:00`,
          `${upcomingEnd}T00:00:00+07:00`,
        )
      : Promise.resolve([]);
  const recentPetCareRecordsPromise: ReturnType<
    typeof listRecentHouseholdPetCareRecords
  > = householdId
    ? listRecentHouseholdPetCareRecords(supabase, householdId, 3)
    : Promise.resolve([]);
  const choresPromise: ReturnType<typeof listChoreWorkspace> = householdId
    ? listChoreWorkspace(supabase, householdId)
    : Promise.resolve({ templates: [], assignees: [], occurrences: [] });
  const shoppingPromise: ReturnType<typeof listShoppingItems> = householdId
    ? listShoppingItems(supabase, householdId)
    : Promise.resolve([]);
  const inventoryPromise: ReturnType<typeof listInventoryItems> = householdId
    ? listInventoryItems(supabase, householdId)
    : Promise.resolve([]);

  const profile = await profilePromise;
  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "คุณ";
  const coverMode = themeOverride ?? homeCoverMode(profile?.birthday, now);
  const coverStyle = HOME_COVER_STYLES[coverMode];
  const isBirthday = coverMode === "birthday";
  return (
    <div className="landscape-home-grid finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-4 px-4 pb-8 pt-3">
      <section className="app-cover app-cover-home light-cover-copy time-cover relative h-48 overflow-hidden rounded-[1.75rem] p-5 shadow-card sm:h-52 sm:p-6">
        <Image
          src={coverStyle.src}
          alt={coverStyle.alt}
          fill
          priority
          sizes="(orientation: landscape) and (min-width: 1024px) calc(100vw - 7rem), (min-width: 700px) calc(100vw - 3rem), 100vw"
          className="app-cover-image time-cover-image object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="time-cover-overlay absolute inset-0"
        />
        <Link
          href="/profile/notifications"
          aria-label="ดูประวัติการแจ้งเตือน"
          className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/85 text-finance-primary-strong shadow-sm backdrop-blur-sm transition-transform active:scale-95"
        >
          <AppIcon name="bell" className="size-5" />
        </Link>
        <p className="relative max-w-[72%] text-xs font-medium text-finance-muted">
          {thaiToday(today)}
        </p>
        <h1 className="relative mt-2 max-w-[72%] text-2xl font-semibold leading-tight text-finance-text">
          {isBirthday
            ? `สุขสันต์วันเกิด ${displayName} 🎉`
            : `${greetingForBangkok(now)} ${displayName}`}
        </h1>
        <p className="relative mt-2 max-w-[62%] text-sm leading-relaxed text-finance-muted">
          {isBirthday
            ? "วันนี้ให้บ้านของเราช่วยฉลองวันพิเศษของคุณนะ"
            : "วันนี้ก็มาดูแลบ้านของเราไปด้วยกันนะ"}
        </p>
      </section>

      <Suspense fallback={<HomeTodaySkeleton />}>
        <HomeTodaySections
          today={today}
          tomorrow={tomorrow}
          eventsPromise={eventsPromise}
          tasksPromise={tasksPromise}
          remindersPromise={remindersPromise}
          dueFinancePromise={dueFinancePromise}
          petCarePromise={petCarePromise}
          choresPromise={choresPromise}
          shoppingPromise={shoppingPromise}
          inventoryPromise={inventoryPromise}
        />
      </Suspense>

      <Suspense fallback={<HomeSecondarySkeleton />}>
        <HomeSecondarySections
          financePromise={financePromise}
          recentTransactionsPromise={recentTransactionsPromise}
          petsPromise={petsPromise}
          dueFinancePromise={dueFinancePromise}
          petCarePromise={petCarePromise}
          recentPetCareRecordsPromise={recentPetCareRecordsPromise}
          choresPromise={choresPromise}
          shoppingPromise={shoppingPromise}
          inventoryPromise={inventoryPromise}
          householdName={household?.name ?? null}
          today={today}
        />
      </Suspense>
    </div>
  );
}

async function HomeTodaySections({
  today,
  tomorrow,
  eventsPromise,
  tasksPromise,
  remindersPromise,
  dueFinancePromise,
  petCarePromise,
  choresPromise,
  shoppingPromise,
  inventoryPromise,
}: {
  today: string;
  tomorrow: string;
  eventsPromise: ReturnType<typeof listCalendarEvents>;
  tasksPromise: ReturnType<typeof listPlanTasks>;
  remindersPromise: ReturnType<typeof listPlanReminders>;
  dueFinancePromise: ReturnType<typeof listCalendarFinanceItems>;
  petCarePromise: ReturnType<typeof listScheduledPetCareRecords>;
  choresPromise: ReturnType<typeof listChoreWorkspace>;
  shoppingPromise: ReturnType<typeof listShoppingItems>;
  inventoryPromise: ReturnType<typeof listInventoryItems>;
}) {
  const [
    events,
    tasks,
    reminders,
    dueFinance,
    petCare,
    chores,
    shopping,
    inventory,
  ] = await Promise.all([
    eventsPromise,
    tasksPromise,
    remindersPromise,
    dueFinancePromise,
    petCarePromise,
    choresPromise,
    shoppingPromise,
    inventoryPromise,
  ]);
  const todayEvents = events.filter((event) => eventDate(event) === today);
  const dueTasks = tasks.filter(
    (task) => !task.is_completed && task.due_date && task.due_date <= today,
  );
  const overdueTasks = dueTasks.filter((task) => task.due_date! < today);
  const todayTasks = dueTasks.filter((task) => task.due_date === today);
  const upcomingReminders = reminders.filter(
    (reminder) => toBangkokInput(reminder.reminds_at).slice(0, 10) <= tomorrow,
  );
  const todayFinance = dueFinance.filter((item) => item.date === today);
  const todayPetCare = petCare.filter(
    (record) =>
      record.scheduled_at &&
      toBangkokInput(record.scheduled_at).slice(0, 10) === today,
  );
  const choreTemplates = new Map(
    chores.templates.map((template) => [template.id, template]),
  );
  const dueChores = chores.occurrences
    .filter((item) => !item.completed_at && item.due_date <= today)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const overdueChores = dueChores.filter((item) => item.due_date < today);
  const todayChores = dueChores.filter((item) => item.due_date === today);
  const pendingShopping = shopping.filter((item) => !item.purchased_at);
  const attentionInventory = inventory.filter(
    (item) =>
      isLowStock(item) ||
      isDateWithinDays(item.expiry_date, today, 30) ||
      isDateWithinDays(item.warranty_expires_on, today, 30),
  );
  const todayQueue = [
    ...overdueTasks.map((task) => ({
      key: `task-${task.id}`,
      href: `/calendar/tasks/${task.id}`,
      marker: "เลยกำหนด",
      title: task.title,
      detail: planDateLabel(task.due_date, task.due_time),
    })),
    ...overdueChores.map((chore) => ({
      key: `chore-${chore.id}`,
      href: "/chores",
      marker: "งานบ้านค้าง",
      title: choreTemplates.get(chore.template_id)?.title ?? "งานบ้าน",
      detail: `กำหนด ${chore.due_date}`,
    })),
    ...todayEvents.map((event) => ({
      key: `event-${event.id}`,
      href: `/calendar/${event.id}`,
      marker: "นัดหมาย",
      title: event.title,
      detail: event.is_all_day ? "ทั้งวัน" : formatEventTime(event.starts_at!),
    })),
    ...todayChores.map((chore) => {
      const dueTime = choreTemplates.get(chore.template_id)?.due_time;
      return {
        key: `chore-${chore.id}`,
        href: "/chores",
        marker: "งานบ้าน",
        title: choreTemplates.get(chore.template_id)?.title ?? "งานบ้าน",
        detail: dueTime ? `${dueTime.slice(0, 5)} น.` : "วันนี้",
      };
    }),
    ...todayTasks.map((task) => ({
      key: `task-${task.id}`,
      href: `/calendar/tasks/${task.id}`,
      marker: "งาน",
      title: task.title,
      detail: planDateLabel(task.due_date, task.due_time),
    })),
    ...todayFinance.map((item) => ({
      key: `finance-${item.source}-${item.sourceId}`,
      href: item.href,
      marker: "การเงิน",
      title: item.title,
      detail: "ครบกำหนดวันนี้",
    })),
    ...todayPetCare.map((record) => ({
      key: `pet-care-${record.id}`,
      href: `/pets/${record.pet_id}`,
      marker: PET_CARE_RECORD_LABEL[record.record_type],
      title: `${record.pet?.name ?? "สัตว์เลี้ยง"} · ${record.title}`,
      detail: petCareDateLabel(record.scheduled_at!),
    })),
    ...upcomingReminders.map((reminder) => ({
      key: `reminder-${reminder.id}`,
      href: `/calendar/reminders/${reminder.id}`,
      marker: "เตือน",
      title: reminder.title,
      detail: reminderDateLabel(reminder.reminds_at),
    })),
    ...attentionInventory.slice(0, 2).map((item) => ({
      key: `inventory-${item.id}`,
      href: `/inventory/${item.id}`,
      marker: isLowStock(item) ? "ควรเติม" : "ใกล้กำหนด",
      title: item.name,
      detail: isLowStock(item)
        ? `เหลือ ${inventoryQuantityLabel(item)}`
        : "ตรวจวันหมดอายุหรือประกัน",
    })),
    ...pendingShopping.slice(0, 2).map((item) => ({
      key: `shopping-${item.id}`,
      href: "/shopping",
      marker: "ต้องซื้อ",
      title: item.name,
      detail: `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`,
    })),
  ];
  const visibleTodayQueue = todayQueue.slice(0, 8);
  const remainingTodayItemCount = todayQueue.length - visibleTodayQueue.length;
  const currentWeek = weekDates(today);

  return (
    <>
      <DashboardCard
        title="วันนี้ต้องดู"
        icon="calendar"
        className="ring-1 ring-finance-primary/15"
      >
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <DashboardMetric
            href="/calendar"
            icon="calendar"
            value={
              overdueTasks.length +
              todayEvents.length +
              todayTasks.length +
              upcomingReminders.length
            }
            label="แผนงาน"
          />
          <DashboardMetric
            href="/finance"
            icon="finance"
            value={todayFinance.length}
            label="การเงิน"
          />
          <DashboardMetric
            href="/pets"
            icon="pets"
            value={todayPetCare.length}
            label="สัตว์เลี้ยง"
          />
          <DashboardMetric
            href="/chores"
            icon="chores"
            value={dueChores.length}
            label="งานบ้าน"
          />
          <DashboardMetric
            href="/shopping"
            icon="shopping"
            value={pendingShopping.length}
            label="ต้องซื้อ"
          />
          <DashboardMetric
            href="/inventory"
            icon="inventory"
            value={attentionInventory.length}
            label="คลังของ"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {visibleTodayQueue.map((item) => (
            <TodayItem
              key={item.key}
              href={item.href}
              marker={item.marker}
              title={item.title}
              detail={item.detail}
            />
          ))}
          {todayQueue.length === 0 ? (
            <EmptyToday text="วันนี้เรียบร้อยดี ยังไม่มีเรื่องที่ต้องจัดการ" />
          ) : null}
          {remainingTodayItemCount > 0 ? (
            <p className="rounded-[1rem] bg-finance-primary-soft/30 px-3 py-2.5 text-center text-sm font-medium text-finance-primary-strong">
              ยังมีอีก {remainingTodayItemCount} รายการในแต่ละหมวด
            </p>
          ) : null}
        </div>
      </DashboardCard>

      <section
        className="rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card"
        aria-label="ปฏิทินครอบครัวสัปดาห์นี้"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-finance-muted">สัปดาห์นี้</p>
            <h2 className="font-semibold text-finance-text">ปฏิทินครอบครัว</h2>
          </div>
          <Link
            href="/calendar"
            className="text-sm font-medium text-finance-primary-strong"
          >
            ดูทั้งหมด
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {currentWeek.map((date) => {
            const count =
              events.filter((event) => eventDate(event) === date).length +
              tasks.filter(
                (task) => !task.is_completed && task.due_date === date,
              ).length +
              reminders.filter(
                (reminder) =>
                  toBangkokInput(reminder.reminds_at).slice(0, 10) === date,
              ).length;
            const isToday = date === today;
            return (
              <Link
                key={date}
                href={`/calendar?date=${date}`}
                className={`flex min-w-0 flex-col items-center rounded-[0.9rem] px-1 py-2 ${isToday ? "bg-finance-primary text-finance-primary-foreground" : "bg-finance-primary-soft/35 text-finance-text"}`}
              >
                <span
                  className={`text-[10px] ${isToday ? "text-finance-primary-foreground/80" : "text-finance-muted"}`}
                >
                  {new Intl.DateTimeFormat("th-TH", {
                    weekday: "narrow",
                    timeZone: "UTC",
                  }).format(new Date(`${date}T00:00:00Z`))}
                </span>
                <span className="mt-0.5 text-sm font-semibold tabular-nums">
                  {Number(date.slice(-2))}
                </span>
                <span
                  className={`mt-1 size-1.5 rounded-full ${count ? (isToday ? "bg-finance-primary-foreground" : "bg-finance-primary") : "bg-transparent"}`}
                />
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

async function HomeSecondarySections({
  financePromise,
  recentTransactionsPromise,
  petsPromise,
  dueFinancePromise,
  petCarePromise,
  recentPetCareRecordsPromise,
  choresPromise,
  shoppingPromise,
  inventoryPromise,
  householdName,
  today,
}: {
  financePromise: ReturnType<typeof getFinanceSummary>;
  recentTransactionsPromise: ReturnType<typeof listRecentFinanceTransactions>;
  petsPromise: ReturnType<typeof listPetSummaries>;
  dueFinancePromise: ReturnType<typeof listCalendarFinanceItems>;
  petCarePromise: ReturnType<typeof listScheduledPetCareRecords>;
  recentPetCareRecordsPromise: ReturnType<
    typeof listRecentHouseholdPetCareRecords
  >;
  choresPromise: ReturnType<typeof listChoreWorkspace>;
  shoppingPromise: ReturnType<typeof listShoppingItems>;
  inventoryPromise: ReturnType<typeof listInventoryItems>;
  householdName: string | null;
  today: string;
}) {
  const [
    finance,
    recentTransactions,
    pets,
    dueFinance,
    petCare,
    recentPetCareRecords,
    chores,
    shopping,
    inventory,
  ] = await Promise.all([
    financePromise,
    recentTransactionsPromise,
    petsPromise,
    dueFinancePromise,
    petCarePromise,
    recentPetCareRecordsPromise,
    choresPromise,
    shoppingPromise,
    inventoryPromise,
  ]);
  const recentPetCare = recentPetCareRecords.flatMap((record) =>
    record.pet ? [{ pet: record.pet, record }] : [],
  );
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
    <>
      <section className="landscape-span-full grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="การเงิน"
          href="/finance"
          linkLabel="ดู"
          icon="wallet"
        >
          <div className="space-y-2">
            {finance.monthTotals.length ? (
              finance.monthTotals.map((total) => (
                <div
                  key={total.currency}
                  className="rounded-[1rem] bg-finance-primary-soft/60 p-3"
                >
                  <p className="text-xs text-finance-muted">
                    รายจ่ายวันนี้ · {total.currency}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-finance-text">
                    {formatCurrency(total.expense, total.currency)}
                  </p>
                  <p className="text-xs text-emerald-700">
                    รายรับ {formatCurrency(total.income, total.currency)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyToday text="วันนี้ยังไม่มีรายการรับ–จ่าย" />
            )}
            {dueFinance.length ? (
              <p className="text-xs text-finance-muted">
                มี {dueFinance.length} บิลหรือค่างวดใกล้ครบกำหนด
              </p>
            ) : null}
          </div>
        </DashboardCard>

        <DashboardCard
          title="สัตว์เลี้ยง"
          href="/pets"
          linkLabel="ดู"
          icon="pets"
        >
          <p className="text-sm text-finance-muted">
            {pets.length
              ? `${pets.length} ตัว · ${pets.map((pet) => pet.name).join(" · ")}`
              : "ยังไม่มีสัตว์เลี้ยง"}
          </p>
          <div className="mt-3 flex min-w-0 flex-col gap-2">
            {petCare.slice(0, 2).map((record) => (
              <TodayItem
                key={record.id}
                href={`/pets/${record.pet_id}`}
                marker={PET_CARE_RECORD_LABEL[record.record_type]}
                title={`${record.pet?.name ?? "สัตว์เลี้ยง"} · ${record.title}`}
                detail={petCareDateLabel(record.scheduled_at!)}
              />
            ))}
            {petCare.length === 0 ? (
              <EmptyToday text="ไม่มีตารางดูแลใน 7 วันข้างหน้า" />
            ) : null}
          </div>
        </DashboardCard>

        <DashboardCard
          title="ครอบครัว"
          href="/household"
          linkLabel="ดู"
          icon="household"
        >
          <div className="rounded-[1rem] bg-finance-primary-soft/45 p-3">
            <p className="font-semibold text-finance-text">
              {householdName ?? "บ้านของเรา"}
            </p>
            <p className="mt-1 text-sm text-finance-muted">
              สมาชิก สิทธิ์การใช้งาน และเรื่องที่ช่วยกันดูแล
            </p>
          </div>
        </DashboardCard>
      </section>

      <section className="landscape-span-full grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="งานบ้าน"
          href="/chores"
          linkLabel="ดูทั้งหมด"
          icon="chores"
        >
          <p className="mb-3 text-sm text-finance-muted">
            {openChores.length
              ? `เหลือ ${openChores.length} งานที่ยังไม่เสร็จ`
              : "งานบ้านเรียบร้อยแล้ว"}
          </p>
          <div className="flex min-w-0 flex-col gap-2">
            {openChores.slice(0, 2).map((chore) => (
              <TodayItem
                key={`chore-summary-${chore.id}`}
                href="/chores"
                marker={chore.due_date < today ? "ค้าง" : "งานบ้าน"}
                title={
                  choreTemplates.get(chore.template_id)?.title ?? "งานบ้าน"
                }
                detail={chore.due_date}
              />
            ))}
            {openChores.length === 0 ? (
              <EmptyToday text="ไม่มีงานบ้านค้างอยู่" />
            ) : null}
          </div>
        </DashboardCard>

        <DashboardCard
          title="รายการซื้อของ"
          href="/shopping"
          linkLabel="ดูทั้งหมด"
          icon="shopping"
        >
          <p className="mb-3 text-sm text-finance-muted">
            {pendingShopping.length
              ? `รอซื้อ ${pendingShopping.length} รายการ`
              : "ซื้อครบตามรายการแล้ว"}
          </p>
          <div className="flex min-w-0 flex-col gap-2">
            {pendingShopping.slice(0, 2).map((item) => (
              <TodayItem
                key={`shopping-summary-${item.id}`}
                href="/shopping"
                marker="ต้องซื้อ"
                title={item.name}
                detail={`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
              />
            ))}
            {pendingShopping.length === 0 ? (
              <EmptyToday text="ยังไม่มีของที่ต้องซื้อ" />
            ) : null}
          </div>
        </DashboardCard>

        <DashboardCard
          title="คลังของในบ้าน"
          href="/inventory"
          linkLabel="ดูทั้งหมด"
          icon="inventory"
        >
          <p className="mb-3 text-sm text-finance-muted">
            {attentionInventory.length
              ? `มี ${attentionInventory.length} รายการที่ควรตรวจดู`
              : `ของในคลัง ${inventory.length} รายการอยู่ในสถานะปกติ`}
          </p>
          <div className="flex min-w-0 flex-col gap-2">
            {attentionInventory.slice(0, 2).map((item) => (
              <TodayItem
                key={`inventory-summary-${item.id}`}
                href={`/inventory/${item.id}`}
                marker={isLowStock(item) ? "ใกล้หมด" : "ใกล้กำหนด"}
                title={item.name}
                detail={inventoryQuantityLabel(item)}
              />
            ))}
            {attentionInventory.length === 0 ? (
              <EmptyToday text="ยังไม่มีของใกล้หมดหรือใกล้กำหนด" />
            ) : null}
          </div>
        </DashboardCard>
      </section>

      <section
        aria-label="ทางลัด"
        className="landscape-span-full grid grid-cols-2 gap-2 rounded-[1.5rem] bg-finance-surface-strong p-2 shadow-card [&>*:last-child]:col-span-2 sm:grid-cols-5 sm:[&>*:last-child]:col-span-1"
      >
        <QuickLink href="/chores" icon="chores" label="งานบ้าน" />
        <QuickLink href="/finance" icon="finance" label="เพิ่มรายการ" />
        <QuickLink href="/shopping" icon="shopping" label="รายการซื้อของ" />
        <QuickLink href="/pets" icon="pets" label="บันทึกสัตว์เลี้ยง" />
        <QuickLink href="/inventory" icon="inventory" label="คลังของในบ้าน" />
      </section>

      <TodaySection
        title="กิจกรรมล่าสุด"
        href="/finance/transactions"
        linkLabel="ดูทั้งหมด"
      >
        {recentTransactions.map((item) => (
          <TodayItem
            key={item.transactionId}
            href={`/finance/transactions/${item.transactionId}`}
            marker={item.creatorName ?? "การเงิน"}
            title={item.title ?? item.categoryName ?? "รายการการเงิน"}
            detail={formatCurrency(item.amount, item.currency)}
          />
        ))}
        {recentPetCare.map(({ pet, record }) => (
          <TodayItem
            key={`pet-activity-${record.id}`}
            href={`/pets/${pet.id}`}
            marker={PET_CARE_RECORD_LABEL[record.record_type]}
            title={`${pet.name} · ${record.title}`}
            detail={petCareDateLabel(record.created_at)}
          />
        ))}
        {recentTransactions.length === 0 && recentPetCare.length === 0 ? (
          <EmptyToday text="ยังไม่มีกิจกรรมล่าสุด" />
        ) : null}
      </TodaySection>
    </>
  );
}

function HomeTodaySkeleton() {
  return (
    <>
      <div className="min-h-64 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
      <div className="min-h-32 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
    </>
  );
}

function HomeSecondarySkeleton() {
  return (
    <>
      <div className="landscape-span-full grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-h-44 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
        <div className="min-h-44 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
        <div className="min-h-44 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
      </div>
      <div className="landscape-span-full grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-h-44 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
        <div className="min-h-44 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
        <div className="min-h-44 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
      </div>
      <div className="landscape-span-full min-h-28 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
      <div className="landscape-span-full min-h-28 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
    </>
  );
}

function DashboardCard({
  title,
  href,
  linkLabel,
  icon,
  className = "",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  icon: AppIconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={`min-w-0 rounded-[1.5rem] bg-finance-surface-strong ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
            <AppIcon name={icon} className="size-5" />
          </span>
          <h2 className="truncate font-semibold text-finance-text">{title}</h2>
        </div>
        {href && linkLabel ? (
          <Link
            href={href}
            className="shrink-0 text-sm font-medium text-finance-primary-strong"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: AppIconName;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[1.1rem] bg-finance-primary-soft/45 px-2 text-center text-sm font-medium text-finance-text transition-colors hover:bg-finance-primary-soft"
    >
      <AppIcon name={icon} className="size-6 text-finance-primary-strong" />
      <span>{label}</span>
    </Link>
  );
}

function TodaySection({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="landscape-span-full flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-finance-text">{title}</h2>
        <Link
          href={href}
          className="text-sm font-medium text-finance-primary-strong"
        >
          {linkLabel}
        </Link>
      </div>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </section>
  );
}

function TodayItem({
  href,
  marker,
  title,
  detail,
}: {
  href: string;
  marker: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-[1rem] bg-finance-primary-soft/30 px-3 py-2.5 transition-colors hover:bg-finance-primary-soft/55"
    >
      <span className="shrink-0 rounded-full bg-finance-primary-soft px-2.5 py-1 text-xs font-medium text-finance-primary-strong">
        {marker}
      </span>
      <p className="min-w-0 flex-1 truncate font-medium text-finance-text">
        {title}
      </p>
      <p className="max-w-[42%] shrink-0 truncate text-sm text-finance-muted">
        {detail}
      </p>
    </Link>
  );
}

function DashboardMetric({
  href,
  icon,
  value,
  label,
}: {
  href: string;
  icon: AppIconName;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col items-center rounded-[1rem] bg-finance-primary-soft/45 px-2 py-2.5 text-center transition-colors hover:bg-finance-primary-soft"
    >
      <AppIcon
        name={icon}
        className="mb-1 size-4 text-finance-primary-strong"
      />
      <p className="text-lg font-semibold tabular-nums text-finance-text">
        {value}
      </p>
      <p className="truncate text-[11px] text-finance-muted">{label}</p>
    </Link>
  );
}

function EmptyToday({ text }: { text: string }) {
  return (
    <div className="rounded-[1rem] bg-finance-primary-soft/30 px-3 py-3">
      <p className="text-sm text-finance-muted">{text}</p>
    </div>
  );
}
