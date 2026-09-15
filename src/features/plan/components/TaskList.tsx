import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { togglePlanTaskAction } from "../actions";
import { planDateLabel, priorityLabel } from "../domain";
import type { PlanTask } from "../types";

export function TaskList({ tasks }: { tasks: PlanTask[] }) {
  if (!tasks.length) {
    return <Card><p className="text-sm text-foreground-muted">ยังไม่มีงานในมุมมองนี้</p></Card>;
  }
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <Card key={task.id} className="flex min-w-0 items-start gap-3 p-3">
          <form action={togglePlanTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="completed" value={String(!task.is_completed)} />
            <button
              type="submit"
              aria-label={task.is_completed ? `ทำให้ ${task.title} ยังไม่เสร็จ` : `ทำ ${task.title} ให้เสร็จ`}
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                task.is_completed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface",
              )}
            >
              {task.is_completed ? "✓" : ""}
            </button>
          </form>
          <Link href={`/calendar/tasks/${task.id}`} className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className={cn("truncate font-medium", task.is_completed && "text-foreground-muted line-through")}>{task.title}</p>
              {task.priority === "HIGH" ? <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">{priorityLabel.HIGH}</span> : null}
            </div>
            <p className="mt-1 truncate text-xs text-foreground-muted">{task.list_name} · {planDateLabel(task.due_date, task.due_time)}</p>
            <p className="mt-1 text-xs text-foreground-muted">{task.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p>
          </Link>
        </Card>
      ))}
    </div>
  );
}
