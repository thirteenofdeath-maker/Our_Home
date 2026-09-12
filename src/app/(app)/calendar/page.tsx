import Link from "next/link";

import { listCalendarEvents } from "@/features/calendar/api";
import { AddCalendarEventFab } from "@/features/calendar/components/AddCalendarEventFab";
import { MonthCalendar } from "@/features/calendar/components/MonthCalendar";
import { listCalendarFinanceItems } from "@/features/calendar/finance";
import { bangkokDateKey, monthKey, selectedDateForMonth, shiftMonth } from "@/features/calendar/domain/calendar";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const now = new Date();
  const month = monthKey(typeof query.month === "string" ? query.month : undefined, now);
  const requested = typeof query.date === "string" ? query.date : undefined;
  const today = bangkokDateKey(now);
  const selected = selectedDateForMonth(month, requested, now);
  const endMonth=shiftMonth(month,1);
  const [events, archived, financeItems] = await Promise.all([
    listCalendarEvents(supabase, household?.id ?? null, user.id),
    listCalendarEvents(supabase, household?.id ?? null, user.id, true),
    listCalendarFinanceItems(supabase,`${month}-01`,`${endMonth}-01`),
  ]);

  return <div className="flex flex-col gap-5">
    <header><h1 className="text-xl font-semibold">ปฏิทิน</h1></header>
    <AddCalendarEventFab />
    <MonthCalendar month={month} selected={selected} today={today} events={events} financeItems={financeItems} />
    {archived.length ? <section><h2 className="mb-2 font-semibold">เก็บเข้าคลัง</h2><div className="flex flex-col gap-2">{archived.map((event) => <Link className="text-primary" key={event.id} href={`/calendar/${event.id}`}>{event.title}</Link>)}</div></section> : null}
  </div>;
}
