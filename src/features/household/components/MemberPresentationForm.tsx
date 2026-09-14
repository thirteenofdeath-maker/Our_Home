"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { updateMemberPresentationAction } from "../actions";
import { MEMBER_COLORS } from "../domain/member";

export function MemberPresentationForm({ householdId, displayName, memberColor }: { householdId: string; displayName: string; memberColor: string }) {
  const [state, action] = useActionState(updateMemberPresentationAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="ชื่อที่แสดง" htmlFor="displayName">
        <Input id="displayName" name="displayName" defaultValue={displayName} required maxLength={80} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground-muted">สีสมาชิก</legend>
        <div className="flex gap-3">
          {MEMBER_COLORS.map((color) => (
            <label key={color} className="cursor-pointer">
              <input className="peer sr-only" type="radio" name="memberColor" value={color} defaultChecked={color === memberColor} required />
              <span className="block size-8 rounded-full border-2 border-transparent peer-checked:border-foreground" style={{ backgroundColor: color }} />
            </label>
          ))}
        </div>
      </fieldset>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton>บันทึก</SubmitButton>
    </form>
  );
}
