import Link from "next/link";

import { Card } from "@/components/ui/Card";

import { formatEventTime, monthDays, shiftMonth, toBangkokInput } from "../domain/calendar";
import type { CalendarEventView } from "../types";
import type { CalendarFinanceItem } from "../finance";
import { togglePlanTaskAction } from "@/features/plan/actions";
import { planDateLabel } from "@/features/plan/domain";
import type { PlanTask } from "@/features/plan/types";

function eventDate(event: CalendarEventView) {
  return event.is_all_day ? event.all_day_date : toBangkokInput(event.starts_at).slice(0, 10);
}

export function MonthCalendar({ month, selected, today, events, financeItems=[], tasks=[] }: {
  month: string;
  selected: string;
  today: string;
  events: CalendarEventView[];
  financeItems?: CalendarFinanceItem[];
  tasks?: PlanTask[];
}) {
  const byDate = new Map<string, CalendarEventView[]>();
  for (const event of events) {
    const date = eventDate(event);
    if (date) byDate.set(date, [...(byDate.get(date) ?? []), event]);
  }
  const selectedEvents = byDate.get(selected) ?? [];
  const selectedFinance=financeItems.filter(item=>item.date===selected);
  const selectedTasks=tasks.filter(task=>task.due_date===selected);
  const financeCountByDate = new Map<string, number>();
  const taskCountByDate = new Map<string, number>();
  for (const item of financeItems) financeCountByDate.set(item.date, (financeCountByDate.get(item.date) ?? 0) + 1);
  for (const task of tasks) {
    if (task.due_date && !task.is_completed) {
      taskCountByDate.set(task.due_date, (taskCountByDate.get(task.due_date) ?? 0) + 1);
    }
  }

  return <>
    <nav aria-label="เปลี่ยนเดือน" className="flex items-center justify-between">
      <Link className="flex min-h-11 items-center px-3 text-primary" href={`/calendar?month=${shiftMonth(month, -1)}`}>เดือนก่อน</Link>
      <h2 className="font-semibold">{new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}</h2>
      <Link className="flex min-h-11 items-center px-3 text-primary" href={`/calendar?month=${shiftMonth(month, 1)}`}>เดือนถัดไป</Link>
    </nav>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-foreground-muted">
      {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <div key={day}>{day}</div>)}
      {monthDays(month).map((day) => {
        const dayEvents = byDate.get(day.date) ?? [];
        const isSelected = day.date === selected;
        const isToday = day.date === today;
        const financeCount=financeCountByDate.get(day.date) ?? 0;
        const taskCount=taskCountByDate.get(day.date) ?? 0;
        return <Link
          key={day.date}
          href={`/calendar?month=${month}&date=${day.date}`}
          aria-current={isToday ? "date" : undefined}
          aria-label={`${day.date} มีกิจกรรม ${dayEvents.length}${taskCount ? ` งาน ${taskCount}` : ""}${isToday ? " วันนี้" : ""}${isSelected ? " เลือกอยู่" : ""}${financeCount ? ` รายการการเงิน ${financeCount}` : ""}`}
          data-selected={isSelected || undefined}
          className={`min-h-14 rounded-control p-1 text-left focus-visible:outline-2 focus-visible:outline-primary ${isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary" : isToday ? "bg-surface ring-1 ring-primary" : "bg-surface"} ${day.inMonth ? "" : "opacity-40"}`}
        >
          <span className="tabular-nums">{Number(day.date.slice(-2))}</span>
          <span className="mt-1 flex gap-0.5">{dayEvents.slice(0, 3).map((event) => <span key={event.id} className="size-1.5 rounded-full" style={{ backgroundColor: event.creatorColor }} aria-hidden="true" />)}</span>
          {taskCount?<span className="text-[10px]">✓ {taskCount}</span>:null}
          {financeCount?<span className="text-[10px]">฿ {financeCount}</span>:null}
        </Link>;
      })}
    </div>
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">กิจกรรมวันที่ {selected}</h2>
      {selectedEvents.length ? selectedEvents.map((event) => <Link key={event.id} href={`/calendar/${event.id}`}><Card className="flex items-start gap-3"><span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: event.creatorColor }} /><div><p className="font-medium">{event.title}</p><p className="text-sm text-foreground-muted">{event.is_all_day ? "ทั้งวัน" : formatEventTime(event.starts_at!)} · {event.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p></div></Card></Link>) : <Card><p className="text-sm text-foreground-muted">ไม่มีกิจกรรมในวันนี้</p></Card>}
      {selectedFinance.map(item=><Link key={`${item.source}-${item.sourceId}`} href={item.href}><Card><p className="font-medium">{item.title}</p><p className="text-sm text-foreground-muted">{item.source} · {item.status} · {item.scope==="PERSONAL"?"ส่วนตัว":"ครอบครัว"}</p></Card></Link>)}
      {selectedTasks.map(task=><Card key={task.id} className="flex items-start gap-3"><form action={togglePlanTaskAction}><input type="hidden" name="taskId" value={task.id}/><input type="hidden" name="completed" value={String(!task.is_completed)}/><button type="submit" aria-label={task.is_completed?"ทำเครื่องหมายว่ายังไม่เสร็จ":"ทำเครื่องหมายว่าเสร็จ"} className="flex size-8 items-center justify-center rounded-full border border-primary">{task.is_completed?"✓":""}</button></form><Link className="min-w-0 flex-1" href={`/calendar/tasks/${task.id}`}><p className={`font-medium ${task.is_completed?"text-foreground-muted line-through":""}`}>{task.title}</p><p className="text-sm text-foreground-muted">งาน · {planDateLabel(task.due_date,task.due_time)}</p></Link></Card>)}
    </section>
  </>;
}
