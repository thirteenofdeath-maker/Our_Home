"use client";

import { useActionState } from "react";

import {
  Field,
  Input,
  Select,
  Textarea,
  TwoColumnFieldGrid,
} from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import type { Database } from "@/types/database";

import { createChoreAction, updateChoreAction } from "../actions";

export function ChoreForm({
  householdId,
  today,
  members,
  template,
  selectedMemberIds,
}: {
  householdId: string;
  today: string;
  members: Array<{ id: string; label: string }>;
  template?: Database["public"]["Tables"]["chore_templates"]["Row"];
  selectedMemberIds?: string[];
}) {
  const [state, action] = useActionState(
    template ? updateChoreAction : createChoreAction,
    initialActionState,
  );
  useCloseFormSheetOnSuccess(state.success);
  const suffix = template?.id ?? "new";
  const startDate =
    template && template.starts_on > today ? template.starts_on : today;

  return (
    <form action={action} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      {template ? (
        <input type="hidden" name="templateId" value={template.id} />
      ) : null}
      <Field label="งานบ้าน" htmlFor={`chore-title-${suffix}`}>
        <Input
          id={`chore-title-${suffix}`}
          name="title"
          required
          maxLength={120}
          autoFocus
          placeholder="เช่น ให้อาหารแมว"
          defaultValue={template?.title}
        />
      </Field>
      <Field label="รายละเอียด" htmlFor={`chore-details-${suffix}`}>
        <Textarea
          id={`chore-details-${suffix}`}
          name="details"
          maxLength={1000}
          placeholder="วิธีทำหรือสิ่งที่ต้องระวัง"
          defaultValue={template?.details ?? ""}
        />
      </Field>
      <TwoColumnFieldGrid>
        <Field label="หมุนเวียน" htmlFor={`chore-cadence-${suffix}`}>
          <Select
            id={`chore-cadence-${suffix}`}
            name="cadence"
            defaultValue={template?.cadence ?? "DAILY"}
          >
            <option value="DAILY">ทุกวัน</option>
            <option value="WEEKLY">ทุกสัปดาห์</option>
          </Select>
        </Field>
        <Field label="เวลา" htmlFor={`chore-time-${suffix}`}>
          <Input
            id={`chore-time-${suffix}`}
            name="dueTime"
            type="time"
            defaultValue={template?.due_time?.slice(0, 5) ?? ""}
          />
        </Field>
      </TwoColumnFieldGrid>
      <Field label="เริ่มวันที่" htmlFor={`chore-start-${suffix}`}>
        <Input
          id={`chore-start-${suffix}`}
          name="startsOn"
          type="date"
          defaultValue={startDate}
          min={today}
          required
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground-muted">
          ลำดับผู้รับผิดชอบ
        </legend>
        <p className="text-xs text-foreground-muted">
          ระบบจะหมุนตามลำดับรายชื่อด้านล่าง
        </p>
        {members.map((member, index) => (
          <label
            key={member.id}
            className="flex min-h-12 items-center gap-3 rounded-control border border-border/70 bg-surface px-4"
          >
            <input
              type="checkbox"
              name="memberIds"
              value={member.id}
              defaultChecked={
                selectedMemberIds ? selectedMemberIds.includes(member.id) : true
              }
              className="size-5 accent-primary"
            />
            <span className="flex-1">{member.label}</span>
            <span className="text-xs text-foreground-muted">
              ลำดับ {index + 1}
            </span>
          </label>
        ))}
      </fieldset>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {template ? "บันทึกการแก้ไข" : "สร้างตารางหมุนเวียน"}
      </SubmitButton>
    </form>
  );
}
