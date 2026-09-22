import { NextResponse } from "next/server";

import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  bangkokDueDateTime,
  buildIcsCalendar,
  type IcsEntry,
} from "@/features/calendar/ics";
import { createClient } from "@/lib/supabase/server";

type Scope = "all" | "personal" | "household";

function selectedScope(value: string | null): Scope {
  return value === "personal" || value === "household" ? value : "all";
}

function allows(scope: string, selected: Scope) {
  return selected === "all" || scope.toLowerCase() === selected;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const selected = selectedScope(
    new URL(request.url).searchParams.get("scope"),
  );
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const [eventsResult, tasksResult, remindersResult, birthdaysResult] =
    await Promise.all([
      supabase
        .from("calendar_events")
        .select("id,title,note,scope,is_all_day,all_day_date,starts_at,ends_at")
        .is("archived_at", null),
      supabase
        .from("plan_tasks")
        .select("id,title,details,list_name,scope,due_date,due_time")
        .is("archived_at", null)
        .eq("is_completed", false)
        .not("due_date", "is", null),
      supabase
        .from("plan_reminders")
        .select("id,title,note,scope,reminds_at,recurrence")
        .is("archived_at", null)
        .eq("is_completed", false),
      household && selected !== "personal"
        ? supabase.rpc("get_calendar_export_birthdays", {
            p_household_id: household.id,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);
  const error = [
    eventsResult,
    tasksResult,
    remindersResult,
    birthdaysResult,
  ].find((result) => result.error)?.error;
  if (error) return new NextResponse("Calendar export failed", { status: 500 });

  const origin = new URL(request.url).origin;
  const entries: IcsEntry[] = [];
  for (const event of eventsResult.data ?? []) {
    if (!allows(event.scope, selected)) continue;
    entries.push({
      uid: `event-${event.id}`,
      title: event.title,
      description: event.note,
      url: `${origin}/calendar/${event.id}`,
      allDayDate: event.is_all_day ? event.all_day_date : null,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
    });
  }
  for (const task of tasksResult.data ?? []) {
    if (!task.due_date || !allows(task.scope, selected)) continue;
    entries.push({
      uid: `task-${task.id}`,
      title: `งาน: ${task.title}`,
      description: [task.list_name, task.details].filter(Boolean).join("\n"),
      url: `${origin}/calendar/tasks/${task.id}`,
      allDayDate: task.due_time ? null : task.due_date,
      startsAt: task.due_time
        ? bangkokDueDateTime(task.due_date, task.due_time)
        : null,
    });
  }
  for (const reminder of remindersResult.data ?? []) {
    if (!allows(reminder.scope, selected)) continue;
    entries.push({
      uid: `reminder-${reminder.id}`,
      title: `เตือน: ${reminder.title}`,
      description: reminder.note,
      url: `${origin}/calendar?view=reminders`,
      startsAt: reminder.reminds_at,
      recurrence: reminder.recurrence === "NONE" ? null : reminder.recurrence,
    });
  }
  for (const birthday of birthdaysResult.data ?? []) {
    entries.push({
      uid: `birthday-${birthday.subject_type.toLowerCase()}-${birthday.subject_id}`,
      title: `วันเกิด${birthday.subject_type === "PET" ? "สัตว์เลี้ยง" : ""}: ${birthday.display_name}`,
      allDayDate: `2000-${birthday.month_day}`,
      recurrence: "YEARLY",
      url:
        birthday.subject_type === "PET"
          ? `${origin}/pets/${birthday.subject_id}`
          : `${origin}/household`,
    });
  }
  const body = buildIcsCalendar(entries);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="our-home-calendar.ics"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
