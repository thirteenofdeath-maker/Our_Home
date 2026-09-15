import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { listCalendarEvents } from "@/features/calendar/api";
import {
  bangkokDateKey,
  formatEventTime,
  toBangkokInput,
} from "@/features/calendar/domain/calendar";
import { listCalendarFinanceItems } from "@/features/calendar/finance";
import {
  getFinanceSummary,
  listRecentFinanceTransactions,
} from "@/features/finance/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { getCurrentProfile } from "@/features/profile/api";
import { listPetCareRecords, listPets, listScheduledPetCareRecords } from "@/features/pets/api";
import { PET_CARE_RECORD_LABEL, petCareDateLabel } from "@/features/pets/domain/care-record";
import { listPlanReminders, listPlanTasks } from "@/features/plan/api";
import { planDateLabel, reminderDateLabel } from "@/features/plan/domain";
import { listMyWallets } from "@/features/wallets/api";
import { greetingForBangkok } from "@/features/today/domain";
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

export default async function HomePage() {
  const { supabase, user } = await requireUser();

  const [wallets, household, profile] = await Promise.all([
    listMyWallets(supabase),
    getMyPrimaryHousehold(supabase, user.id),
    getCurrentProfile(supabase, user.id),
  ]);

  if (wallets.length === 0 && !household) {
    redirect("/onboarding");
  }

  const today = bangkokDateKey();
  const tomorrow = shiftDate(today, 1);
  const upcomingEnd = shiftDate(today, 8);
  const householdId = household?.id ?? null;

  const [
    events,
    tasks,
    reminders,
    dueFinance,
    finance,
    recentTransactions,
    pets,
    petCare,
  ] = await Promise.all([
    listCalendarEvents(supabase, householdId, user.id),
    listPlanTasks(supabase),
    listPlanReminders(supabase, { completed: false }),
    listCalendarFinanceItems(supabase, today, upcomingEnd),
    getFinanceSummary(supabase, {
      start: `${today}T00:00:00+07:00`,
      end: `${tomorrow}T00:00:00+07:00`,
    }),
    listRecentFinanceTransactions(supabase, { limit: 5 }),
    householdId ? listPets(supabase, householdId) : Promise.resolve([]),
    householdId
      ? listScheduledPetCareRecords(
          supabase,
          householdId,
          `${today}T00:00:00+07:00`,
          `${upcomingEnd}T00:00:00+07:00`,
        )
      : Promise.resolve([]),
  ]);

  const todayEvents = events.filter((event) => eventDate(event) === today);
  const dueTasks = tasks.filter(
    (task) => !task.is_completed && task.due_date && task.due_date <= today,
  );
  const upcomingReminders = reminders.filter(
    (reminder) => toBangkokInput(reminder.reminds_at).slice(0, 10) <= tomorrow,
  );
  const recentPetCare = (await Promise.all(
    pets.map(async (pet) => ({ pet, records: await listPetCareRecords(supabase, pet.id) })),
  ))
    .flatMap(({ pet, records }) => records.map((record) => ({ pet, record })))
    .toSorted((a, b) => b.record.created_at.localeCompare(a.record.created_at))
    .slice(0, 3);
  const displayName = profile?.display_name || user.email?.split("@")[0] || "คุณ";
  const todayItemCount = todayEvents.length + dueTasks.length + upcomingReminders.length;
  const currentWeek = weekDates(today);

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-4 px-4 pb-8 pt-3">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,#f4e8d9,#f7f4e9_52%,#e6efe2)] p-5 shadow-card sm:p-6">
        <div className="absolute -right-10 -top-12 size-36 rounded-full bg-white/35" />
        <p className="relative text-sm font-medium text-finance-muted">{thaiToday(today)}</p>
        <h1 className="relative mt-1 text-2xl font-semibold text-finance-text sm:text-3xl">
          {greetingForBangkok()} {displayName}
        </h1>
        <p className="relative mt-2 max-w-md text-sm text-finance-muted">
          วันนี้ก็มาดูแลบ้านของเราไปด้วยกันนะ
        </p>
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <TodayMetric value={todayEvents.length} label="นัดหมาย" />
          <TodayMetric value={dueTasks.length} label="งานค้าง" />
          <TodayMetric value={upcomingReminders.length} label="รายการเตือน" />
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card" aria-label="ปฏิทินครอบครัวสัปดาห์นี้">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-finance-muted">สัปดาห์นี้</p>
            <h2 className="font-semibold text-finance-text">ปฏิทินครอบครัว</h2>
          </div>
          <Link href="/calendar" className="text-sm font-medium text-finance-primary-strong">ดูทั้งหมด</Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {currentWeek.map((date) => {
            const count = events.filter((event) => eventDate(event) === date).length
              + tasks.filter((task) => !task.is_completed && task.due_date === date).length
              + reminders.filter((reminder) => toBangkokInput(reminder.reminds_at).slice(0, 10) === date).length;
            const isToday = date === today;
            return (
              <Link key={date} href={`/calendar?date=${date}`} className={`flex min-w-0 flex-col items-center rounded-[0.9rem] px-1 py-2 ${isToday ? "bg-finance-primary text-white" : "bg-finance-primary-soft/35 text-finance-text"}`}>
                <span className={`text-[10px] ${isToday ? "text-white/80" : "text-finance-muted"}`}>{new Intl.DateTimeFormat("th-TH", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))}</span>
                <span className="mt-0.5 text-sm font-semibold tabular-nums">{Number(date.slice(-2))}</span>
                <span className={`mt-1 size-1.5 rounded-full ${count ? (isToday ? "bg-white" : "bg-finance-primary") : "bg-transparent"}`} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-2 gap-3">
        <DashboardCard title="งานวันนี้" href="/calendar" linkLabel="ดูทั้งหมด" icon="calendar" className="col-span-2">
          <p className="mb-3 text-sm text-finance-muted">{todayItemCount ? `${todayItemCount} รายการที่ต้องดู` : "วันนี้ยังไม่มีรายการค้าง"}</p>
          <div className="flex min-w-0 flex-col gap-2">
            {todayEvents.slice(0, 3).map((event) => <TodayItem key={`event-${event.id}`} href={`/calendar/${event.id}`} marker="นัดหมาย" title={event.title} detail={event.is_all_day ? "ทั้งวัน" : formatEventTime(event.starts_at!)} />)}
            {dueTasks.slice(0, 3).map((task) => <TodayItem key={`task-${task.id}`} href={`/calendar/tasks/${task.id}`} marker={task.due_date! < today ? "เลยกำหนด" : "งาน"} title={task.title} detail={planDateLabel(task.due_date, task.due_time)} />)}
            {upcomingReminders.slice(0, 2).map((reminder) => <TodayItem key={`reminder-${reminder.id}`} href={`/calendar/reminders/${reminder.id}`} marker="เตือน" title={reminder.title} detail={reminderDateLabel(reminder.reminds_at)} />)}
            {todayItemCount === 0 ? <EmptyToday text="วันนี้ว่าง ลองเพิ่มงานหรือวางแผนใหม่ได้เลย" /> : null}
          </div>
        </DashboardCard>

        <DashboardCard title="การเงิน" href="/finance" linkLabel="ดู" icon="wallet">
          <div className="space-y-2">
            {finance.monthTotals.length ? finance.monthTotals.map((total) => (
              <div key={total.currency} className="rounded-[1rem] bg-finance-primary-soft/60 p-3">
                <p className="text-xs text-finance-muted">รายจ่ายวันนี้ · {total.currency}</p>
                <p className="mt-1 text-xl font-semibold text-finance-text">{formatCurrency(total.expense, total.currency)}</p>
                <p className="text-xs text-emerald-700">รายรับ {formatCurrency(total.income, total.currency)}</p>
              </div>
            )) : <EmptyToday text="วันนี้ยังไม่มีรายการรับ–จ่าย" />}
            {dueFinance.length ? <p className="text-xs text-finance-muted">มี {dueFinance.length} บิลหรือค่างวดใกล้ครบกำหนด</p> : null}
          </div>
        </DashboardCard>

        <DashboardCard title="สัตว์เลี้ยง" href="/pets" linkLabel="ดู" icon="pets">
          <p className="text-sm text-finance-muted">{pets.length ? `${pets.length} ตัว · ${pets.map((pet) => pet.name).join(" · ")}` : "ยังไม่มีสัตว์เลี้ยง"}</p>
          <div className="mt-3 flex min-w-0 flex-col gap-2">
            {petCare.slice(0, 2).map((record) => <TodayItem key={record.id} href={`/pets/${record.pet_id}`} marker={PET_CARE_RECORD_LABEL[record.record_type]} title={`${record.pet?.name ?? "สัตว์เลี้ยง"} · ${record.title}`} detail={petCareDateLabel(record.scheduled_at!)} />)}
            {petCare.length === 0 ? <EmptyToday text="ไม่มีตารางดูแลใน 7 วันข้างหน้า" /> : null}
          </div>
        </DashboardCard>
      </section>

      <section aria-label="ทางลัด" className="grid grid-cols-2 gap-2 rounded-[1.5rem] bg-finance-surface-strong p-2 shadow-card sm:grid-cols-4">
        <QuickLink href="/calendar?view=tasks" icon="calendar" label="งานของฉัน" />
        <QuickLink href="/finance" icon="finance" label="เพิ่มรายการ" />
        <QuickLink href="/calendar" icon="calendar" label="วางแผนครอบครัว" />
        <QuickLink href="/pets" icon="pets" label="บันทึกสัตว์เลี้ยง" />
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
    </div>
  );
}

function DashboardCard({ title, href, linkLabel, icon, className = "", children }: { title: string; href: string; linkLabel: string; icon: AppIconName; className?: string; children: ReactNode }) {
  return <Card className={`min-w-0 rounded-[1.5rem] bg-finance-surface-strong ${className}`}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong"><AppIcon name={icon} className="size-5" /></span><h2 className="truncate font-semibold text-finance-text">{title}</h2></div>
      <Link href={href} className="shrink-0 text-sm font-medium text-finance-primary-strong">{linkLabel}</Link>
    </div>
    {children}
  </Card>;
}

function QuickLink({ href, icon, label }: { href: string; icon: AppIconName; label: string }) {
  return <Link href={href} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[1.1rem] bg-finance-primary-soft/45 px-2 text-center text-sm font-medium text-finance-text transition-colors hover:bg-finance-primary-soft">
    <AppIcon name={icon} className="size-6 text-finance-primary-strong" />
    <span>{label}</span>
  </Link>;
}

function TodayMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-[1.15rem] bg-white/75 px-2 py-3 text-center backdrop-blur-sm">
      <p className="text-xl font-semibold tabular-nums text-finance-text">
        {value}
      </p>
      <p className="truncate text-xs text-finance-muted">{label}</p>
    </div>
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
    <section className="flex min-w-0 flex-col gap-2">
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
    <Link href={href} className="min-w-0">
      <Card className="flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-finance-surface-strong py-3">
        <span className="shrink-0 rounded-full bg-finance-primary-soft px-2.5 py-1 text-xs font-medium text-finance-primary-strong">
          {marker}
        </span>
        <p className="min-w-0 flex-1 truncate font-medium text-finance-text">
          {title}
        </p>
        <p className="max-w-[42%] shrink-0 truncate text-sm text-finance-muted">{detail}</p>
      </Card>
    </Link>
  );
}

function EmptyToday({ text }: { text: string }) {
  return (
    <Card className="rounded-[1.25rem] bg-finance-surface-strong">
      <p className="text-sm text-finance-muted">{text}</p>
    </Card>
  );
}
