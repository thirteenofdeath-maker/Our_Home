"use client";

import { useActionState } from "react";

import { Field, Input, Select, Textarea, TwoColumnFieldGrid } from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { createChoreAction } from "../actions";

export function ChoreForm({
  householdId,
  today,
  members,
}: {
  householdId: string;
  today: string;
  members: Array<{ id: string; label: string }>;
}) {
  const [state, action] = useActionState(createChoreAction, initialActionState);
  useCloseFormSheetOnSuccess(state.success);

  return (
    <form action={action} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="งานบ้าน" htmlFor="chore-title">
        <Input id="chore-title" name="title" required maxLength={120} autoFocus placeholder="เช่น ให้อาหารแมว" />
      </Field>
      <Field label="รายละเอียด" htmlFor="chore-details">
        <Textarea id="chore-details" name="details" maxLength={1000} placeholder="วิธีทำหรือสิ่งที่ต้องระวัง" />
      </Field>
      <TwoColumnFieldGrid>
        <Field label="หมุนเวียน" htmlFor="chore-cadence">
          <Select id="chore-cadence" name="cadence" defaultValue="DAILY">
            <option value="DAILY">ทุกวัน</option>
            <option value="WEEKLY">ทุกสัปดาห์</option>
          </Select>
        </Field>
        <Field label="เวลา" htmlFor="chore-time">
          <Input id="chore-time" name="dueTime" type="time" />
        </Field>
      </TwoColumnFieldGrid>
      <Field label="เริ่มวันที่" htmlFor="chore-start">
        <Input id="chore-start" name="startsOn" type="date" defaultValue={today} min={today} required />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground-muted">ลำดับผู้รับผิดชอบ</legend>
        <p className="text-xs text-foreground-muted">ระบบจะหมุนตามลำดับรายชื่อด้านล่าง</p>
        {members.map((member, index) => (
          <label key={member.id} className="flex min-h-12 items-center gap-3 rounded-control border border-border/70 bg-surface px-4">
            <input type="checkbox" name="memberIds" value={member.id} defaultChecked className="size-5 accent-primary" />
            <span className="flex-1">{member.label}</span>
            <span className="text-xs text-foreground-muted">ลำดับ {index + 1}</span>
          </label>
        ))}
      </fieldset>
      {state.error ? <p aria-live="polite" className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">สร้างตารางหมุนเวียน</SubmitButton>
    </form>
  );
}

