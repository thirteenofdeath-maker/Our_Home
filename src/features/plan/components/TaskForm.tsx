"use client";

import { useActionState, useState } from "react";

import {
  Field,
  Input,
  Select,
  Textarea,
  TwoColumnFieldGrid,
} from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { createPlanTaskAction, updatePlanTaskAction } from "../actions";
import type { PlanTask } from "../types";

export function TaskForm({
  hasHousehold,
  task,
}: {
  hasHousehold: boolean;
  task?: PlanTask;
}) {
  const [state, action] = useActionState(
    task ? updatePlanTaskAction : createPlanTaskAction,
    initialActionState,
  );
  const [scope, setScope] = useState(task?.scope ?? "PERSONAL");
  return (
    <form
      action={action}
      className="finance-ui-tone flex min-w-0 flex-col gap-4"
    >
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}
      <Field label="ชื่องาน" htmlFor="plan-task-title">
        <Input
          id="plan-task-title"
          name="title"
          maxLength={160}
          required
          defaultValue={task?.title}
          placeholder="สิ่งที่ต้องทำ"
        />
      </Field>
      <Field label="รายละเอียด" htmlFor="plan-task-details">
        <Textarea
          id="plan-task-details"
          name="details"
          maxLength={5000}
          defaultValue={task?.details ?? ""}
          placeholder="รายละเอียดเพิ่มเติม"
        />
      </Field>
      <Field label="ลิสต์" htmlFor="plan-task-list">
        <Input
          id="plan-task-list"
          name="listName"
          maxLength={80}
          required
          defaultValue={task?.list_name ?? "งานของฉัน"}
        />
      </Field>
      <Field label="ขอบเขต" htmlFor="plan-task-scope">
        {task ? (
          <>
            <Input
              id="plan-task-scope"
              value={task.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
              disabled
            />
            <input type="hidden" name="scope" value={task.scope} />
          </>
        ) : (
          <Select
            id="plan-task-scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as typeof scope)}
          >
            <option value="PERSONAL">ส่วนตัว</option>
            {hasHousehold ? <option value="HOUSEHOLD">ครอบครัว</option> : null}
          </Select>
        )}
      </Field>
      <TwoColumnFieldGrid>
        <Field label="วันที่ครบกำหนด" htmlFor="plan-task-date">
          <Input
            id="plan-task-date"
            name="dueDate"
            type="date"
            defaultValue={task?.due_date ?? ""}
          />
        </Field>
        <Field label="เวลา" htmlFor="plan-task-time">
          <Input
            id="plan-task-time"
            name="dueTime"
            type="time"
            defaultValue={task?.due_time?.slice(0, 5) ?? ""}
          />
        </Field>
      </TwoColumnFieldGrid>
      <Field label="ความสำคัญ" htmlFor="plan-task-priority">
        <Select
          id="plan-task-priority"
          name="priority"
          defaultValue={task?.priority ?? "NORMAL"}
        >
          <option value="LOW">ต่ำ</option>
          <option value="NORMAL">ปกติ</option>
          <option value="HIGH">สำคัญ</option>
        </Select>
      </Field>
      {state.error ? (
        <p className="text-sm text-danger" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {task ? "บันทึกการแก้ไข" : "เพิ่มงาน"}
      </SubmitButton>
    </form>
  );
}
