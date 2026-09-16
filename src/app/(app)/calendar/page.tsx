import Link from "next/link";

import { TopLevelCover } from "@/components/shared/TopLevelCover";
import { Card } from "@/components/ui/Card";
import { listCalendarEvents } from "@/features/calendar/api";
import { AddCalendarEventFab } from "@/features/calendar/components/AddCalendarEventFab";
import { MonthCalendar } from "@/features/calendar/components/MonthCalendar";
import { listCalendarFinanceItems } from "@/features/calendar/finance";
import {
  bangkokDateKey,
  monthKey,
  selectedDateForMonth,
  shiftMonth,
  toBangkokInput,
} from "@/features/calendar/domain/calendar";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const now = new Date();
  const month = monthKey(
    typeof query.month === "string" ? query.month : undefined,
    now,
  );
  const requested = typeof query.date === "string" ? query.date : undefined;
  const today = bangkokDateKey(now);
  const selected = selectedDateForMonth(month, requested, now);
  const endMonth = shiftMonth(month, 1);
  const [events, archived, financeItems] = await Promise.all([
    listCalendarEvents(supabase, household?.id ?? null, user.id),
    listCalendarEvents(supabase, household?.id ?? null, user.id, true),
    listCalendarFinanceItems(supabase, `${month}-01`, `${endMonth}-01`),
  ]);
  const upcoming = [
    ...events.map((event) => ({
      key: `event-${event.id}`,
      date: event.is_all_day
        ? (event.all_day_date ?? "")
        : toBangkokInput(event.starts_at).slice(0, 10),
      title: event.title,
      meta: event.is_all_day ? "ทั้งวัน" : "กิจกรรม",
      href: `/calendar/${event.id}`,
    })),
    ...financeItems.map((item) => ({
      key: `${item.source}-${item.sourceId}`,
      date: item.date,
      title: item.title,
      meta: "กำหนดการเงิน",
      href: item.href,
    })),
  ]
    .filter((item) => item.date >= today && item.date.startsWith(month))
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <TopLevelCover
        eyebrow="วางแผนร่วมกัน"
        title="แผนงาน"
        description="รวมกิจกรรม นัดหมาย และกำหนดการเงินไว้ในภาพเดียว"
        icon="calendar"
        tone="plan"
      >
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-white/55 px-2.5 py-1">
            {events.length} กิจกรรม
          </span>
          <span className="rounded-full bg-white/55 px-2.5 py-1">
            {financeItems.length} กำหนดการเงิน
          </span>
        </div>
      </TopLevelCover>

      <AddCalendarEventFab />

      <section
        aria-labelledby="upcoming-heading"
        className="flex flex-col gap-2"
      >
        <h2 id="upcoming-heading" className="text-lg font-semibold">
          กำลังจะมาถึง
        </h2>
        {upcoming.length ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {upcoming.map((item) => (
              <Link key={item.key} href={item.href}>
                <Card className="h-full border-l-4 border-l-primary">
                  <p className="text-xs font-medium text-foreground-muted">
                    {item.date} · {item.meta}
                  </p>
                  <p className="mt-1 font-semibold">{item.title}</p>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-foreground-muted">
              ยังไม่มีแผนที่กำลังจะมาถึงในเดือนนี้
            </p>
          </Card>
        )}
      </section>

      <section
        aria-labelledby="calendar-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="calendar-heading" className="text-lg font-semibold">
          ปฏิทิน
        </h2>
        <MonthCalendar
          month={month}
          selected={selected}
          today={today}
          events={events}
          financeItems={financeItems}
        />
      </section>

      {archived.length ? (
        <section>
          <h2 className="mb-2 font-semibold">เก็บเข้าคลัง</h2>
          <div className="flex flex-col gap-2">
            {archived.map((event) => (
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
    </div>
  );
}
