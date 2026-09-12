import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { archiveCalendarEventAction } from "@/features/calendar/actions";
import { getCalendarEvent, getCalendarHouseholdRole } from "@/features/calendar/api";
import { AddCalendarEventFab } from "@/features/calendar/components/AddCalendarEventFab";
import { CALENDAR_TIME_ZONE, formatEventTime } from "@/features/calendar/domain/calendar";
import { canInviteRole } from "@/features/household/domain/member";
import { requireUser } from "@/lib/auth/require-user";

export default async function CalendarEventPage({ params }: PageProps<"/calendar/[eventId]">) {
  const { eventId } = await params;
  const { supabase, user } = await requireUser();
  const event = await getCalendarEvent(supabase, eventId, user.id);
  if (!event) notFound();
  const role = event.household_id ? await getCalendarHouseholdRole(supabase, event.household_id, user.id) : null;
  const canManage = event.created_by === user.id || (event.scope === "HOUSEHOLD" && role && canInviteRole(role, "member"));
  const date = event.is_all_day
    ? `${event.all_day_date} · ทั้งวัน`
    : `${new Intl.DateTimeFormat("th-TH", { timeZone: CALENDAR_TIME_ZONE, dateStyle: "medium" }).format(new Date(event.starts_at!))} ${formatEventTime(event.starts_at!)}${event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}`;

  return <div className="flex flex-col gap-4">
    <AddCalendarEventFab />
    <Card><p className="text-sm text-foreground-muted">{event.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p><h1 className="text-xl font-semibold">{event.title}</h1><p>{date}</p></Card>
    <Card className="flex flex-col gap-2"><p>สร้างโดย: <span style={{ color: event.creatorColor }}>●</span> {event.creatorName}</p><p>ผู้เข้าร่วม: {event.participants.length ? event.participants.map((p) => p.profile?.display_name || p.profile?.email).join(", ") : "ไม่มี"}</p>{event.note ? <p className="whitespace-pre-wrap">{event.note}</p> : null}<p>สถานะ: {event.archived_at ? "เก็บเข้าคลัง" : "ใช้งาน"}</p></Card>
    {canManage ? <div className="flex flex-col gap-2"><Link href={`/calendar/${event.id}/edit`} className={buttonClassName("secondary", "md")}>แก้ไข</Link><form action={archiveCalendarEventAction}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="archived" value={event.archived_at ? "false" : "true"} /><button className={buttonClassName("primary", "md")} type="submit">{event.archived_at ? "นำกลับมาใช้งาน" : "เก็บเข้าคลัง"}</button></form></div> : null}
  </div>;
}
