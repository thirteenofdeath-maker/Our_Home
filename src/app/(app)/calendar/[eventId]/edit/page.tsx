import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { getCalendarEvent, getCalendarHouseholdRole } from "@/features/calendar/api";
import { CalendarEventForm } from "@/features/calendar/components/CalendarEventForm";
import { listHouseholdMembers } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditCalendarEventPage({ params }: PageProps<"/calendar/[eventId]/edit">) {
  const { eventId } = await params;
  const { supabase, user } = await requireUser();
  const event = await getCalendarEvent(supabase, eventId, user.id);
  if (!event) notFound();
  const role = event.household_id ? await getCalendarHouseholdRole(supabase, event.household_id, user.id) : null;
  const allowed = event.created_by === user.id || (event.scope === "HOUSEHOLD" && role && canInviteRole(role, "member"));
  if (!allowed) redirect(`/calendar/${eventId}`);
  const members = event.household_id ? await listHouseholdMembers(supabase, event.household_id) : [];
  return <div className="flex flex-col gap-4"><h1 className="text-xl font-semibold">แก้ไขกิจกรรม</h1><Card><CalendarEventForm members={members} event={event} /></Card></div>;
}
