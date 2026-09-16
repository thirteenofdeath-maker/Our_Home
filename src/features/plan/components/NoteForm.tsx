"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { createPlanNoteAction, updatePlanNoteAction } from "../actions";
import type { PlanNote } from "../types";

export function NoteForm({
  hasHousehold,
  note,
}: {
  hasHousehold: boolean;
  note?: PlanNote;
}) {
  const [state, action] = useActionState(
    note ? updatePlanNoteAction : createPlanNoteAction,
    initialActionState,
  );
  const [scope, setScope] = useState(note?.scope ?? "PERSONAL");
  return (
    <form
      action={action}
      className="finance-ui-tone flex min-w-0 flex-col gap-4"
    >
      {note ? <input type="hidden" name="noteId" value={note.id} /> : null}
      <Field label="หัวข้อ" htmlFor="plan-note-title">
        <Input
          id="plan-note-title"
          name="title"
          maxLength={160}
          defaultValue={note?.title ?? ""}
          placeholder="หัวข้อโน้ต"
        />
      </Field>
      <Field label="ข้อความ" htmlFor="plan-note-content">
        <Textarea
          id="plan-note-content"
          name="content"
          maxLength={20000}
          defaultValue={note?.content ?? ""}
          className="h-48 resize-y"
          placeholder="เขียนสิ่งที่อยากจำ…"
        />
      </Field>
      <Field label="ขอบเขต" htmlFor="plan-note-scope">
        {note ? (
          <>
            <Input
              id="plan-note-scope"
              value={note.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
              disabled
            />
            <input type="hidden" name="scope" value={note.scope} />
          </>
        ) : (
          <Select
            id="plan-note-scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as typeof scope)}
          >
            <option value="PERSONAL">ส่วนตัว</option>
            {hasHousehold ? <option value="HOUSEHOLD">ครอบครัว</option> : null}
          </Select>
        )}
      </Field>
      <Field label="สีโน้ต" htmlFor="plan-note-color">
        <Select
          id="plan-note-color"
          name="color"
          defaultValue={note?.color ?? "SAGE"}
        >
          <option value="SAGE">เขียวเสจ</option>
          <option value="SKY">ฟ้า</option>
          <option value="SAND">ทราย</option>
          <option value="ROSE">ชมพู</option>
          <option value="LILAC">ม่วงอ่อน</option>
          <option value="WHITE">ขาว</option>
        </Select>
      </Field>
      {state.error ? (
        <p className="text-sm text-danger" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {note ? "บันทึกการแก้ไข" : "เพิ่มโน้ต"}
      </SubmitButton>
    </form>
  );
}
