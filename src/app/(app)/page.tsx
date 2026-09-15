import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

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
import { listPets } from "@/features/pets/api";
import { listPlanReminders, listPlanTasks } from "@/features/plan/api";
import { planDateLabel, reminderDateLabel } from "@/features/plan/domain";
import { listMyWallets } from "@/features/wallets/api";
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

export default async function HomePage() {
  const { supabase, user } = await requireUser();

  const [wallets, household] = await Promise.all([
    listMyWallets(supabase),
    getMyPrimaryHousehold(supabase, user.id),
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
  ]);

  const todayEvents = events.filter((event) => eventDate(event) === today);
  const dueTasks = tasks.filter(
    (task) => !task.is_completed && task.due_date && task.due_date <= today,
  );
  const upcomingReminders = reminders.filter(
    (reminder) => toBangkokInput(reminder.reminds_at).slice(0, 10) <= tomorrow,
  );

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <header>
        <p className="text-sm text-finance-muted">{thaiToday(today)}</p>
        <h1 className="text-2xl font-semibold text-finance-text">วันนี้</h1>
      </header>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,#e8f1e5,#f7f4e9_52%,#f5eadc)] p-5 shadow-card">
        <div className="absolute -right-8 -top-10 size-32 rounded-full bg-white/45" />
        <p className="relative text-sm font-medium text-finance-muted">
          ภาพรวมของบ้านวันนี้
        </p>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <TodayMetric value={todayEvents.length} label="นัดหมาย" />
          <TodayMetric value={dueTasks.length} label="งานค้าง" />
          <TodayMetric value={upcomingReminders.length} label="กำลังเตือน" />
        </div>
      </section>

      <TodaySection title="ต้องทำวันนี้" href="/calendar" linkLabel="ดูแพลน">
        {todayEvents.map((event) => (
          <TodayItem
            key={`event-${event.id}`}
            href={`/calendar/${event.id}`}
            marker="นัดหมาย"
            title={event.title}
            detail={
              event.is_all_day ? "ทั้งวัน" : formatEventTime(event.starts_at!)
            }
          />
        ))}
        {dueTasks.map((task) => (
          <TodayItem
            key={`task-${task.id}`}
            href={`/calendar/tasks/${task.id}`}
            marker={task.due_date! < today ? "เลยกำหนด" : "งาน"}
            title={task.title}
            detail={planDateLabel(task.due_date, task.due_time)}
          />
        ))}
        {upcomingReminders.map((reminder) => (
          <TodayItem
            key={`reminder-${reminder.id}`}
            href={`/calendar/reminders/${reminder.id}`}
            marker="เตือน"
            title={reminder.title}
            detail={reminderDateLabel(reminder.reminds_at)}
          />
        ))}
        {todayEvents.length === 0 &&
        dueTasks.length === 0 &&
        upcomingReminders.length === 0 ? (
          <EmptyToday text="วันนี้ยังไม่มีนัดหมายหรืองานค้าง" />
        ) : null}
      </TodaySection>

      <TodaySection
        title="บิลและค่างวดใกล้ถึงกำหนด"
        href="/finance/bills"
        linkLabel="ดูการเงิน"
      >
        {dueFinance.slice(0, 4).map((item) => (
          <TodayItem
            key={`${item.source}-${item.sourceId}`}
            href={item.href}
            marker={item.date === today ? "วันนี้" : item.date}
            title={item.title}
            detail={item.status}
          />
        ))}
        {dueFinance.length === 0 ? (
          <EmptyToday text="ไม่มีบิลหรือค่างวดใน 7 วันข้างหน้า" />
        ) : null}
      </TodaySection>

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/finance" className="min-w-0">
          <Card className="h-full rounded-[1.4rem] bg-finance-surface-strong">
            <p className="text-sm text-finance-muted">รายรับ–รายจ่ายวันนี้</p>
            <div className="mt-3 space-y-2">
              {finance.monthTotals.length ? (
                finance.monthTotals.map((total) => (
                  <div
                    key={total.currency}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="text-finance-muted">{total.currency}</span>
                    <span className="text-right font-medium text-finance-text">
                      <span className="text-emerald-700">
                        +{formatCurrency(total.income, total.currency)}
                      </span>
                      <span className="mx-1 text-finance-muted">/</span>
                      <span className="text-rose-600">
                        -{formatCurrency(total.expense, total.currency)}
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-finance-muted">
                  ยังไม่มีรายการวันนี้
                </p>
              )}
            </div>
          </Card>
        </Link>
        <Link href="/pets" className="min-w-0">
          <Card className="h-full rounded-[1.4rem] bg-finance-surface-strong">
            <p className="text-sm text-finance-muted">สัตว์เลี้ยงในบ้าน</p>
            <p className="mt-2 text-3xl font-semibold text-finance-text">
              {pets.length}
            </p>
            <p className="text-sm text-finance-muted">
              {pets.length
                ? pets.map((pet) => pet.name).join(" · ")
                : "ยังไม่มีสัตว์เลี้ยง"}
            </p>
          </Card>
        </Link>
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
        {recentTransactions.length === 0 ? (
          <EmptyToday text="ยังไม่มีกิจกรรมล่าสุด" />
        ) : null}
      </TodaySection>
    </div>
  );
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
        <p className="shrink-0 text-sm text-finance-muted">{detail}</p>
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
