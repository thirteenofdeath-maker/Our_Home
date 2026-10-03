"use client";

import { useActionState, useState } from "react";

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
import {
  CHORE_WEEKDAYS,
  choreScheduleDefaults,
  type ChoreScheduleMode,
} from "../schedule";

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
  const scheduleDefaults = choreScheduleDefaults(template, startDate);
  const [scheduleMode, setScheduleMode] = useState<ChoreScheduleMode>(
    scheduleDefaults.mode,
  );

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
      <Field label="ทำซ้ำ" htmlFor={`chore-schedule-mode-${suffix}`}>
        <Select
          id={`chore-schedule-mode-${suffix}`}
          name="scheduleMode"
          value={scheduleMode}
          onChange={(event) =>
            setScheduleMode(event.target.value as ChoreScheduleMode)
          }
        >
          <option value="EVERY_DAY">ทุกวัน</option>
          <option value="WEEKDAY">ทุกวัน…ของสัปดาห์</option>
          <option value="MONTH_DAY">ทุกวันที่…ของเดือน</option>
          <option value="CUSTOM">กำหนดช่วงเอง</option>
        </Select>
      </Field>
      {scheduleMode === "WEEKDAY" ? (
        <Field label="วันประจำสัปดาห์" htmlFor={`chore-weekday-${suffix}`}>
          <Select
            id={`chore-weekday-${suffix}`}
            name="weekday"
            defaultValue={scheduleDefaults.weekday}
          >
            {CHORE_WEEKDAYS.map((label, weekday) => (
              <option key={label} value={weekday}>
                ทุก{label}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="weekday" value={scheduleDefaults.weekday} />
      )}
      {scheduleMode === "MONTH_DAY" ? (
        <Field label="วันที่ประจำเดือน" htmlFor={`chore-month-day-${suffix}`}>
          <Select
            id={`chore-month-day-${suffix}`}
            name="monthDay"
            defaultValue={scheduleDefaults.monthDay}
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                ทุกวันที่ {day} ของเดือน
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input
          type="hidden"
          name="monthDay"
          value={scheduleDefaults.monthDay}
        />
      )}
      {scheduleMode === "CUSTOM" ? (
        <Field label="ทำซ้ำทุก" htmlFor={`chore-interval-${suffix}`}>
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
            <Input
              id={`chore-interval-${suffix}`}
              name="intervalCount"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              required
              defaultValue={template?.interval_count ?? 2}
              aria-label="จำนวนรอบ"
            />
            <Select
              id={`chore-cadence-${suffix}`}
              name="cadence"
              defaultValue={template?.cadence ?? "DAILY"}
              aria-label="หน่วยการทำซ้ำ"
            >
              <option value="DAILY">วัน</option>
              <option value="WEEKLY">สัปดาห์</option>
              <option value="MONTHLY">เดือน</option>
              <option value="YEARLY">ปี</option>
            </Select>
          </div>
          <p className="mt-1.5 text-xs text-foreground-muted">
            เช่น ทุก 2 วัน หรือทุก 3 เดือน
          </p>
        </Field>
      ) : (
        <>
          <input type="hidden" name="intervalCount" value="1" />
          <input type="hidden" name="cadence" value="DAILY" />
        </>
      )}
      <TwoColumnFieldGrid>
        <Field label="เวลา" htmlFor={`chore-time-${suffix}`}>
          <Input
            id={`chore-time-${suffix}`}
            name="dueTime"
            type="time"
            defaultValue={template?.due_time?.slice(0, 5) ?? ""}
          />
        </Field>
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
      </TwoColumnFieldGrid>
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
