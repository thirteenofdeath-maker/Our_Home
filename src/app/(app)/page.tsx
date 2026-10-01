import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { listCalendarEvents } from "@/features/calendar/api";
import {
  bangkokDateKey,
  toBangkokInput,
} from "@/features/calendar/domain/calendar";
import { listCalendarFinanceItems } from "@/features/calendar/finance";
import { listChoreWorkspace } from "@/features/chores/api";
import { listRecentFinanceTransactions } from "@/features/finance/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listInventoryItems } from "@/features/inventory/api";
import { isDateWithinDays, isLowStock } from "@/features/inventory/types";
import { getCurrentProfile } from "@/features/profile/api";
import {
  listRecentHouseholdPetCareRecords,
  listScheduledPetCareRecords,
} from "@/features/pets/api";
import {
  PET_CARE_RECORD_LABEL,
  petCareDateLabel,
} from "@/features/pets/domain/care-record";
import { listPlanReminders, listPlanTasks } from "@/features/plan/api";
import { planDateLabel, reminderDateLabel } from "@/features/plan/domain";
import { getFinanceReport } from "@/features/reports/api";
import type { FinanceReport } from "@/features/reports/types";
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

function daysBetween(earlierDate: string, laterDate: string) {
  const millisecondsPerDay = 86_400_000;
  return Math.max(
    1,
    Math.round(
      (Date.parse(`${laterDate}T00:00:00Z`) -
        Date.parse(`${earlierDate}T00:00:00Z`)) /
        millisecondsPerDay,
    ),
  );
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
  const overdueStart = shiftDate(today, -365);
  const householdId = household?.id ?? null;

  const eventsPromise = listCalendarEvents(supabase, householdId, user.id);
  const tasksPromise = listPlanTasks(supabase);
  const remindersPromise = listPlanReminders(supabase);
  const dueFinancePromise = listCalendarFinanceItems(
    supabase,
    overdueStart,
    upcomingEnd,
  );
  const todayStart = `${today}T00:00:00+07:00`;
  const tomorrowStart = `${tomorrow}T00:00:00+07:00`;
  const personalFinancePromise = getFinanceReport(
    supabase,
    "PERSONAL",
    null,
    todayStart,
    tomorrowStart,
  );
  const householdFinancePromise: Promise<FinanceReport | null> = householdId
    ? getFinanceReport(
        supabase,
        "HOUSEHOLD",
        householdId,
        todayStart,
        tomorrowStart,
      )
    : Promise.resolve(null);
  const recentTransactionsPromise = listRecentFinanceTransactions(supabase, {
    limit: 5,
  });
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
          personalFinancePromise={personalFinancePromise}
          householdFinancePromise={householdFinancePromise}
          shoppingPromise={shoppingPromise}
          inventoryPromise={inventoryPromise}
        />
      </Suspense>

      <Suspense fallback={<HomeSecondarySkeleton />}>
        <HomeSecondarySections
          recentTransactionsPromise={recentTransactionsPromise}
          recentPetCareRecordsPromise={recentPetCareRecordsPromise}
        />
      </Suspense>
    </div>
  );
}

type TimelineItem = {
  key: string;
  href: string;
  category: string;
  icon: AppIconName;
  title: string;
  detail: string;
  timeLabel: string;
  sortKey: string;
  completed: boolean | null;
};

type DailySummaryItem = {
  key: string;
  href: string;
  icon: AppIconName;
  label: string;
  value: string;
  detail: string;
};

type CompactDailySummaryItem = Pick<
  DailySummaryItem,
  "key" | "href" | "icon" | "label" | "detail"
>;

type FinanceDailySummaryItem = {
  key: string;
  currency: string;
  personal: {
    income: string;
    expense: string;
    due: number;
  };
  household: {
    income: string;
    expense: string;
    due: number;
  } | null;
};

const FINANCE_COMPLETE_STATUSES = new Set([
  "PAID",
  "POSTED",
  "SKIPPED",
  "RESOLVED",
]);

async function HomeTodaySections({
  today,
  tomorrow,
  eventsPromise,
  tasksPromise,
  remindersPromise,
  dueFinancePromise,
  petCarePromise,
  choresPromise,
  personalFinancePromise,
  householdFinancePromise,
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
  personalFinancePromise: ReturnType<typeof getFinanceReport>;
  householdFinancePromise: Promise<FinanceReport | null>;
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
    personalFinance,
    householdFinance,
    shopping,
    inventory,
  ] = await Promise.all([
    eventsPromise,
    tasksPromise,
    remindersPromise,
    dueFinancePromise,
    petCarePromise,
    choresPromise,
    personalFinancePromise,
    householdFinancePromise,
    shoppingPromise,
    inventoryPromise,
  ]);
  const choreTemplates = new Map(
    chores.templates.map((template) => [template.id, template]),
  );

  const timelineForDate = (date: string): TimelineItem[] =>
    [
      ...events
        .filter((event) => eventDate(event) === date)
        .map((event) => {
          const time = event.is_all_day
            ? null
            : toBangkokInput(event.starts_at).slice(11, 16);
          return {
            key: `event-${event.id}`,
            href: `/calendar/${event.id}`,
            category: "ปฏิทิน",
            icon: "calendar" as const,
            title: event.title,
            detail: event.is_all_day ? "กิจกรรมทั้งวัน" : "นัดหมาย",
            timeLabel: time ? `${time} น.` : "ทั้งวัน",
            sortKey: time ?? "00:00",
            completed: null,
          };
        }),
      ...tasks
        .filter((task) => task.due_date === date)
        .map((task) => ({
          key: `task-${task.id}`,
          href: `/calendar/tasks/${task.id}`,
          category: "แผนงาน",
          icon: "chores" as const,
          title: task.title,
          detail: task.list_name || planDateLabel(task.due_date, task.due_time),
          timeLabel: task.due_time
            ? `${task.due_time.slice(0, 5)} น.`
            : "ทั้งวัน",
          sortKey: task.due_time?.slice(0, 5) ?? "00:01",
          completed: task.is_completed,
        })),
      ...reminders
        .filter(
          (reminder) =>
            toBangkokInput(reminder.reminds_at).slice(0, 10) === date,
        )
        .map((reminder) => {
          const time = toBangkokInput(reminder.reminds_at).slice(11, 16);
          return {
            key: `reminder-${reminder.id}`,
            href: `/calendar/reminders/${reminder.id}`,
            category: "เตือนความจำ",
            icon: "bell" as const,
            title: reminder.title,
            detail: reminderDateLabel(reminder.reminds_at),
            timeLabel: `${time} น.`,
            sortKey: time,
            completed: reminder.is_completed,
          };
        }),
      ...dueFinance
        .filter((item) => item.date === date)
        .map((item) => ({
          key: `finance-${item.source}-${item.sourceId}`,
          href: item.href,
          category: "การเงิน",
          icon: "finance" as const,
          title: item.title,
          detail: FINANCE_COMPLETE_STATUSES.has(item.status)
            ? "จัดการแล้ว"
            : "ครบกำหนด",
          timeLabel: "ทั้งวัน",
          sortKey: "00:02",
          completed: FINANCE_COMPLETE_STATUSES.has(item.status),
        })),
      ...petCare
        .filter(
          (record) =>
            record.scheduled_at &&
            toBangkokInput(record.scheduled_at).slice(0, 10) === date,
        )
        .map((record) => {
          const time = toBangkokInput(record.scheduled_at).slice(11, 16);
          return {
            key: `pet-care-${record.id}`,
            href: `/pets/${record.pet_id}`,
            category: "สัตว์เลี้ยง",
            icon: "pets" as const,
            title: `${record.pet?.name ?? "สัตว์เลี้ยง"} · ${record.title}`,
            detail: PET_CARE_RECORD_LABEL[record.record_type],
            timeLabel: `${time} น.`,
            sortKey: time,
            completed: null,
          };
        }),
      ...chores.occurrences
        .filter((item) => item.due_date === date)
        .map((chore) => {
          const template = choreTemplates.get(chore.template_id);
          const time = template?.due_time?.slice(0, 5) ?? null;
          return {
            key: `chore-${chore.id}`,
            href: "/calendar?view=chores",
            category: "งานบ้าน",
            icon: "chores" as const,
            title: template?.title ?? "งานบ้าน",
            detail: chore.completed_at ? "เสร็จแล้ว" : "รอดำเนินการ",
            timeLabel: time ? `${time} น.` : "ทั้งวัน",
            sortKey: time ?? "00:03",
            completed: Boolean(chore.completed_at),
          };
        }),
    ].toSorted((a, b) =>
      `${a.sortKey}-${a.category}-${a.title}`.localeCompare(
        `${b.sortKey}-${b.category}-${b.title}`,
      ),
    );

  const todayTimeline = timelineForDate(today);
  const tomorrowTimeline = timelineForDate(tomorrow);
  const overdueTimeline: TimelineItem[] = [
    ...tasks
      .filter(
        (task) => !task.is_completed && task.due_date && task.due_date < today,
      )
      .map((task) => {
        const overdueDays = daysBetween(task.due_date!, today);
        return {
          key: `overdue-task-${task.id}`,
          href: `/calendar/tasks/${task.id}`,
          category: "แผนงาน",
          icon: "chores" as const,
          title: task.title,
          detail: `${task.list_name || planDateLabel(task.due_date, task.due_time)} · ค้าง ${overdueDays} วัน`,
          timeLabel: `${overdueDays} วัน`,
          sortKey: `${task.due_date}-${task.due_time ?? "00:00"}`,
          completed: false,
        };
      }),
    ...reminders
      .filter((reminder) => {
        const reminderDate = toBangkokInput(reminder.reminds_at).slice(0, 10);
        return !reminder.is_completed && reminderDate < today;
      })
      .map((reminder) => {
        const reminderDate = toBangkokInput(reminder.reminds_at).slice(0, 10);
        const overdueDays = daysBetween(reminderDate, today);
        return {
          key: `overdue-reminder-${reminder.id}`,
          href: `/calendar/reminders/${reminder.id}`,
          category: "เตือนความจำ",
          icon: "bell" as const,
          title: reminder.title,
          detail: `${reminderDateLabel(reminder.reminds_at)} · ค้าง ${overdueDays} วัน`,
          timeLabel: `${overdueDays} วัน`,
          sortKey: toBangkokInput(reminder.reminds_at),
          completed: false,
        };
      }),
    ...chores.occurrences
      .filter((chore) => !chore.completed_at && chore.due_date < today)
      .map((chore) => {
        const template = choreTemplates.get(chore.template_id);
        const overdueDays = daysBetween(chore.due_date, today);
        return {
          key: `overdue-chore-${chore.id}`,
          href: "/calendar?view=chores",
          category: "งานบ้าน",
          icon: "chores" as const,
          title: template?.title ?? "งานบ้าน",
          detail: `เลยกำหนด · ค้าง ${overdueDays} วัน`,
          timeLabel: `${overdueDays} วัน`,
          sortKey: `${chore.due_date}-${template?.due_time ?? "00:00"}`,
          completed: false,
        };
      }),
    ...dueFinance
      .filter(
        (item) =>
          item.date < today && !FINANCE_COMPLETE_STATUSES.has(item.status),
      )
      .map((item) => {
        const overdueDays = daysBetween(item.date, today);
        return {
          key: `overdue-finance-${item.source}-${item.sourceId}`,
          href: item.href,
          category: "การเงิน",
          icon: "finance" as const,
          title: item.title,
          detail: `เลยกำหนด · ค้าง ${overdueDays} วัน`,
          timeLabel: `${overdueDays} วัน`,
          sortKey: `${item.date}-00:00`,
          completed: false,
        };
      }),
  ].toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));
  const pendingShopping = shopping.filter((item) => !item.purchased_at);
  const attentionInventory = inventory.filter(
    (item) =>
      isLowStock(item) ||
      isDateWithinDays(item.expiry_date, today, 30) ||
      isDateWithinDays(item.warranty_expires_on, today, 30),
  );
  const openFinanceDue = dueFinance.filter(
    (item) =>
      item.date === today && !FINANCE_COMPLETE_STATUSES.has(item.status),
  );
  const personalFinanceDue = openFinanceDue.filter(
    (item) => item.scope === "PERSONAL",
  ).length;
  const householdFinanceDue = openFinanceDue.filter(
    (item) => item.scope === "HOUSEHOLD",
  ).length;
  const financeCurrencies = [
    ...new Set(
      [...personalFinance.days, ...(householdFinance?.days ?? [])].map(
        (item) => item.currency,
      ),
    ),
  ].toSorted();
  const financeSummaryItems: FinanceDailySummaryItem[] = financeCurrencies.map(
    (currency) => {
      const personal = personalFinance.days.find(
        (item) => item.currency === currency,
      ) ?? { income: "0.00", expense: "0.00" };
      const household = householdFinance?.days.find(
        (item) => item.currency === currency,
      ) ?? { income: "0.00", expense: "0.00" };
      return {
        key: `finance-${currency}`,
        currency,
        personal: {
          income: formatCurrency(personal.income, currency),
          expense: formatCurrency(personal.expense, currency),
          due: personalFinanceDue,
        },
        household: householdFinance
          ? {
              income: formatCurrency(household.income, currency),
              expense: formatCurrency(household.expense, currency),
              due: householdFinanceDue,
            }
          : null,
      };
    },
  );
  const todaySummary: DailySummaryItem[] = [
    ...(attentionInventory.length
      ? [
          {
            key: "inventory",
            href: "/calendar?view=inventory",
            icon: "inventory" as const,
            label: "คลังของ",
            value: `${attentionInventory.length} รายการ`,
            detail: "ใกล้หมด ใกล้หมดอายุ หรือใกล้หมดประกัน",
          },
        ]
      : []),
    ...(pendingShopping.length
      ? [
          {
            key: "shopping",
            href: "/calendar?view=shopping",
            icon: "shopping" as const,
            label: "รายการซื้อของ",
            value: `${pendingShopping.length} รายการ`,
            detail: "ยังรอซื้ออยู่",
          },
        ]
      : []),
  ];
  const compactTodaySummary: CompactDailySummaryItem[] = [
    ...(attentionInventory.length === 0
      ? [
          {
            key: "inventory-ok",
            href: "/calendar?view=inventory",
            icon: "inventory" as const,
            label: "คลังของ",
            detail: "สถานะปกติ",
          },
        ]
      : []),
    ...(pendingShopping.length === 0
      ? [
          {
            key: "shopping-done",
            href: "/calendar?view=shopping",
            icon: "shopping" as const,
            label: "รายการซื้อของ",
            detail: "ซื้อครบแล้ว",
          },
        ]
      : []),
    ...(financeSummaryItems.length === 0
      ? [
          {
            key: "finance-empty",
            href: "/finance",
            icon: "finance" as const,
            label: "การเงินวันนี้",
            detail: `ยังไม่มีรับ–จ่าย · ครบกำหนด ${personalFinanceDue + householdFinanceDue}`,
          },
        ]
      : []),
  ];
  const currentWeek = weekDates(today);

  return (
    <>
      <TimelineCard
        title="งานวันนี้"
        dateLabel={thaiToday(today)}
        items={todayTimeline}
        summaryItems={todaySummary}
        compactSummaryItems={compactTodaySummary}
        financeSummaryItems={financeSummaryItems}
        emptyText="วันนี้ยังไม่มีงานหรือนัดหมาย"
      />

      <TimelineCard
        title="งานค้าง"
        dateLabel="รายการที่เลยกำหนดและยังไม่เสร็จ"
        items={overdueTimeline}
        emptyText="ไม่มีงานค้าง"
        showProgress={false}
      />

      <TimelineCard
        title="งานวันพรุ่งนี้"
        dateLabel={thaiToday(tomorrow)}
        items={tomorrowTimeline}
        emptyText="พรุ่งนี้ยังไม่มีงาน เตรียมวันสบาย ๆ ได้เลย"
      />

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
            const count = timelineForDate(date).length;
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
  recentTransactionsPromise,
  recentPetCareRecordsPromise,
}: {
  recentTransactionsPromise: ReturnType<typeof listRecentFinanceTransactions>;
  recentPetCareRecordsPromise: ReturnType<
    typeof listRecentHouseholdPetCareRecords
  >;
}) {
  const [recentTransactions, recentPetCareRecords] = await Promise.all([
    recentTransactionsPromise,
    recentPetCareRecordsPromise,
  ]);
  const recentPetCare = recentPetCareRecords.flatMap((record) =>
    record.pet ? [{ pet: record.pet, record }] : [],
  );

  return (
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
  );
}

function HomeTodaySkeleton() {
  return (
    <>
      <div className="min-h-64 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
      <div className="min-h-56 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
      <div className="min-h-32 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
    </>
  );
}

function HomeSecondarySkeleton() {
  return (
    <div className="landscape-span-full min-h-36 animate-pulse rounded-[1.5rem] bg-finance-surface-strong shadow-card motion-reduce:animate-none" />
  );
}

function TimelineCard({
  title,
  dateLabel,
  items,
  summaryItems = [],
  compactSummaryItems = [],
  financeSummaryItems = [],
  emptyText,
  showProgress = true,
}: {
  title: string;
  dateLabel: string;
  items: TimelineItem[];
  summaryItems?: DailySummaryItem[];
  compactSummaryItems?: CompactDailySummaryItem[];
  financeSummaryItems?: FinanceDailySummaryItem[];
  emptyText: string;
  showProgress?: boolean;
}) {
  const trackableItems = items.filter((item) => item.completed !== null);
  const completedCount = trackableItems.filter((item) => item.completed).length;
  const progress = trackableItems.length
    ? Math.round((completedCount / trackableItems.length) * 100)
    : 0;

  return (
    <Card className="min-w-0 rounded-[1.5rem] bg-finance-surface-strong ring-1 ring-finance-primary/15">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-finance-muted">{dateLabel}</p>
          <h2 className="mt-0.5 text-lg font-semibold text-finance-text">
            {title}
          </h2>
        </div>
        <span className="rounded-full bg-finance-primary-soft px-3 py-1 text-sm font-medium tabular-nums text-finance-primary-strong">
          {items.length} รายการ
        </span>
      </div>

      {showProgress ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="text-finance-muted">
              {trackableItems.length
                ? `เสร็จ ${completedCount} จาก ${trackableItems.length} งาน`
                : "ยังไม่มีงานที่ติดตามสถานะ"}
            </span>
            <span className="font-semibold tabular-nums text-finance-primary-strong">
              {progress}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`ความคืบหน้า${title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-1.5 overflow-hidden rounded-full bg-finance-primary-soft/70"
          >
            <div
              className="h-full rounded-full bg-finance-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {summaryItems.length ? (
        <div
          aria-label={`รายการที่ต้องจัดการ${title}`}
          className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {summaryItems.map((summary) => (
            <Link
              key={summary.key}
              href={summary.href}
              className="min-w-0 rounded-[1rem] bg-finance-primary-soft/45 p-3 transition-colors hover:bg-finance-primary-soft"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-finance-surface-strong text-finance-primary-strong">
                  <AppIcon name={summary.icon} className="size-4" />
                </span>
                <p className="min-w-0 truncate text-xs font-medium text-finance-muted">
                  {summary.label}
                </p>
              </div>
              <p className="mt-2 truncate font-semibold text-finance-text">
                {summary.value}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-finance-muted">
                {summary.detail}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      {financeSummaryItems.map((summary) => (
        <section
          key={summary.key}
          aria-label={`การเงินวันนี้ ${summary.currency}`}
          className="mt-2 rounded-[1rem] bg-finance-primary-soft/45 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-finance-surface-strong text-finance-primary-strong">
              <AppIcon name="finance" className="size-4" />
            </span>
            <p className="text-xs font-medium text-finance-muted">
              การเงินวันนี้ · {summary.currency}
            </p>
          </div>
          <div
            className={`mt-2 grid gap-2 ${summary.household ? "grid-cols-2" : "grid-cols-1"}`}
          >
            <FinanceScopeSummary
              href="/finance?scope=PERSONAL"
              label="ส่วนตัว"
              summary={summary.personal}
            />
            {summary.household ? (
              <FinanceScopeSummary
                href="/finance?scope=HOUSEHOLD"
                label="ครอบครัว"
                summary={summary.household}
              />
            ) : null}
          </div>
        </section>
      ))}

      {compactSummaryItems.length ? (
        <div
          aria-label={`สถานะเรียบร้อย${title}`}
          className="mt-2 grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2"
        >
          {compactSummaryItems.map((summary) => (
            <Link
              key={summary.key}
              href={summary.href}
              className="flex min-w-0 items-center gap-2 rounded-[0.9rem] bg-finance-primary-soft/25 px-3 py-2 text-xs transition-colors hover:bg-finance-primary-soft/55"
            >
              <AppIcon
                name={summary.icon}
                className="size-4 shrink-0 text-finance-primary-strong"
              />
              <span className="min-w-0 font-medium text-finance-text">
                {summary.label}
              </span>
              <span className="ml-auto shrink-0 text-finance-muted">
                ✓ {summary.detail}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {items.length ? (
        <ol className="mt-4">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="grid min-w-0 grid-cols-[3.75rem_1.25rem_minmax(0,1fr)] gap-2"
            >
              <p className="pt-3 text-right text-xs font-medium tabular-nums text-finance-muted">
                {item.timeLabel}
              </p>
              <div className="relative flex justify-center">
                {index < items.length - 1 ? (
                  <span className="absolute bottom-0 top-5 w-px bg-finance-primary-soft" />
                ) : null}
                <span
                  className={`relative mt-3 flex size-5 items-center justify-center rounded-full ring-4 ring-finance-surface-strong ${item.completed ? "bg-finance-primary text-finance-primary-foreground" : "bg-finance-primary-soft text-finance-primary-strong"}`}
                >
                  {item.completed ? (
                    <span className="text-[10px] font-bold">✓</span>
                  ) : (
                    <AppIcon name={item.icon} className="size-3" />
                  )}
                </span>
              </div>
              <Link
                href={item.href}
                className={`mb-2 min-w-0 rounded-[1rem] bg-finance-primary-soft/30 px-3 py-2.5 transition-colors hover:bg-finance-primary-soft/55 ${item.completed ? "opacity-65" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded-full bg-finance-primary-soft px-2 py-0.5 text-[10px] font-medium text-finance-primary-strong">
                    {item.category}
                  </span>
                  <p
                    className={`min-w-0 flex-1 truncate font-medium text-finance-text ${item.completed ? "line-through" : ""}`}
                  >
                    {item.title}
                  </p>
                </div>
                <p className="mt-1 truncate text-xs text-finance-muted">
                  {item.detail}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4">
          <EmptyToday text={emptyText} />
        </div>
      )}
    </Card>
  );
}

function FinanceScopeSummary({
  href,
  label,
  summary,
}: {
  href: string;
  label: string;
  summary: FinanceDailySummaryItem["personal"];
}) {
  return (
    <Link
      href={href}
      className="min-w-0 rounded-[0.85rem] bg-finance-surface-strong/70 px-2.5 py-2 transition-colors hover:bg-finance-surface-strong"
    >
      <p className="text-xs font-semibold text-finance-text">{label}</p>
      <p className="mt-1 truncate text-xs text-finance-muted">
        รับ {summary.income}
      </p>
      <p className="truncate text-xs text-finance-muted">
        จ่าย {summary.expense}
      </p>
      {summary.due ? (
        <p className="mt-1 text-[11px] font-medium text-finance-primary-strong">
          ครบกำหนด {summary.due}
        </p>
      ) : null}
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

function EmptyToday({ text }: { text: string }) {
  return (
    <div className="rounded-[1rem] bg-finance-primary-soft/30 px-3 py-3">
      <p className="text-sm text-finance-muted">{text}</p>
    </div>
  );
}
