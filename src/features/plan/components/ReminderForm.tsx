"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { createPlanReminderAction, updatePlanReminderAction } from "../actions";
import { reminderInputParts } from "../domain";
import type { PlanReminder } from "../types";

export function ReminderForm({
  hasHousehold,
  reminder,
}: {
  hasHousehold: boolean;
  reminder?: PlanReminder;
}) {
  const [state, action] = useActionState(
    reminder ? updatePlanReminderAction : createPlanReminderAction,
    initialActionState,
  );
  useCloseFormSheetOnSuccess(state.success);
  const [scope, setScope] = useState(reminder?.scope ?? "PERSONAL");
  const initial = reminder ? reminderInputParts(reminder.reminds_at) : null;

  return (
    <form
      action={action}
      className="finance-ui-tone flex min-w-0 flex-col gap-4"
    >
      {reminder ? (
        <input type="hidden" name="reminderId" value={reminder.id} />
      ) : null}
      <Field label="ชื่อรายการเตือน" htmlFor="plan-reminder-title">
        <Input
          id="plan-reminder-title"
          name="title"
          maxLength={160}
          required
          defaultValue={reminder?.title}
          placeholder="สิ่งที่อยากให้เตือน"
        />
      </Field>
      <Field label="รายละเอียด" htmlFor="plan-reminder-note">
        <Textarea
          id="plan-reminder-note"
          name="note"
          maxLength={5000}
          defaultValue={reminder?.note ?? ""}
          placeholder="รายละเอียดเพิ่มเติม"
        />
      </Field>
      <Field label="ขอบเขต" htmlFor="plan-reminder-scope">
        {reminder ? (
          <>
            <Input
              id="plan-reminder-scope"
              value={reminder.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
              disabled
            />
            <input type="hidden" name="scope" value={reminder.scope} />
          </>
        ) : (
          <Select
            id="plan-reminder-scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as typeof scope)}
          >
            <option value="PERSONAL">ส่วนตัว</option>
            {hasHousehold ? <option value="HOUSEHOLD">ครอบครัว</option> : null}
          </Select>
        )}
      </Field>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Field label="วันที่เตือน" htmlFor="plan-reminder-date">
          <Input
            id="plan-reminder-date"
            name="remindDate"
            type="date"
            required
            defaultValue={initial?.date}
          />
        </Field>
        <Field label="เวลา" htmlFor="plan-reminder-time">
          <Input
            id="plan-reminder-time"
            name="remindTime"
            type="time"
            required
            defaultValue={initial?.time}
          />
        </Field>
      </div>
      <Field label="ทำซ้ำ" htmlFor="plan-reminder-recurrence">
        <Select
          id="plan-reminder-recurrence"
          name="recurrence"
          defaultValue={reminder?.recurrence ?? "NONE"}
        >
          <option value="NONE">ครั้งเดียว</option>
          <option value="DAILY">ทุกวัน</option>
          <option value="WEEKLY">ทุกสัปดาห์</option>
          <option value="MONTHLY">ทุกเดือน</option>
          <option value="YEARLY">ทุกปี</option>
        </Select>
      </Field>
      {state.error ? (
        <p className="text-sm text-danger" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {reminder ? "บันทึกการแก้ไข" : "เพิ่มรายการเตือน"}
      </SubmitButton>
    </form>
  );
}
