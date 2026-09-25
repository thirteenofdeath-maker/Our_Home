"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { updateMemberPresentationAction } from "../actions";
import { MemberColorInput } from "./MemberColorInput";

export function MemberPresentationForm({
  householdId,
  displayName,
  memberColor,
}: {
  householdId: string;
  displayName: string;
  memberColor: string;
}) {
  const [state, action] = useActionState(
    updateMemberPresentationAction,
    initialActionState,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="ชื่อที่แสดง" htmlFor="displayName">
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={80}
        />
      </Field>
      <MemberColorInput defaultValue={memberColor} compact />
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton>บันทึก</SubmitButton>
    </form>
  );
}
