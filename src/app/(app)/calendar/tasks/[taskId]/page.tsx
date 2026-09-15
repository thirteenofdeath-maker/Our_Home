import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { archivePlanTaskAction, togglePlanTaskAction } from "@/features/plan/actions";
import { getPlanTask, listPlanTaskSteps } from "@/features/plan/api";
import { TaskForm } from "@/features/plan/components/TaskForm";
import { TaskSteps } from "@/features/plan/components/TaskSteps";
import { planDateLabel, priorityLabel } from "@/features/plan/domain";
import { requireUser } from "@/lib/auth/require-user";

export default async function PlanTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const { supabase, user } = await requireUser();
  const [task, steps, household] = await Promise.all([
    getPlanTask(supabase, taskId),
    listPlanTaskSteps(supabase, taskId),
    getMyPrimaryHousehold(supabase, user.id),
  ]);
  if (!task) notFound();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title="รายละเอียดงาน" backHref="/calendar?view=tasks" />
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-foreground-muted">{task.list_name}</p>
            <h1 className="mt-1 text-xl font-semibold">{task.title}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs">{priorityLabel[task.priority]}</span>
        </div>
        <p className="mt-3 text-sm text-foreground-muted">{planDateLabel(task.due_date, task.due_time)} · {task.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p>
      </Card>
      <TaskSteps taskId={task.id} steps={steps} />
      <Card>
        <h2 className="mb-4 font-semibold">แก้ไขงาน</h2>
        <TaskForm task={task} hasHousehold={Boolean(household)} />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <form action={togglePlanTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="completed" value={String(!task.is_completed)} />
          <Button type="submit" variant="secondary">{task.is_completed ? "เปิดงานอีกครั้ง" : "ทำเสร็จแล้ว"}</Button>
        </form>
        <form action={archivePlanTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="archived" value={String(!task.archived_at)} />
          <Button type="submit" variant="ghost">{task.archived_at ? "นำออกจากคลัง" : "เก็บเข้าคลัง"}</Button>
        </form>
      </div>
    </div>
  );
}
