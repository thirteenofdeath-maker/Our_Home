import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  getCalendarEvent,
  getCalendarHouseholdRole,
} from "@/features/calendar/api";
import { CalendarEventForm } from "@/features/calendar/components/CalendarEventForm";
import { listHouseholdMembers } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditCalendarEventPage({
  params,
}: PageProps<"/calendar/[eventId]/edit">) {
  const { eventId } = await params;
  const { supabase, user } = await requireUser();
  const event = await getCalendarEvent(supabase, eventId, user.id);
  if (!event) notFound();
  const role = event.household_id
    ? await getCalendarHouseholdRole(supabase, event.household_id, user.id)
    : null;
  const allowed =
    event.created_by === user.id ||
    (event.scope === "HOUSEHOLD" && role && canInviteRole(role, "member"));
  if (!allowed) redirect(`/calendar/${eventId}`);
  const members = event.household_id
    ? await listHouseholdMembers(supabase, event.household_id)
    : [];
  return (
    <div className="finance-scope -mx-4 -mt-2 flex flex-col gap-4 px-4 pb-8 pt-2">
      <PageHeader title="แก้ไขกิจกรรม" backHref={`/calendar/${eventId}`} />
      <Card className="rounded-[1.25rem] bg-finance-surface-strong">
        <CalendarEventForm members={members} event={event} />
      </Card>
    </div>
  );
}
