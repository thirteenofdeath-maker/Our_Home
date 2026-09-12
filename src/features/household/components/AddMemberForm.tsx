"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { addHouseholdMemberAction } from "../actions";

export function AddMemberForm({
  householdId,
  canInviteAdmin = false,
  variant = "page",
}: {
  householdId: string;
  canInviteAdmin?: boolean;
  /** Presentation only — no card chrome to strip either way; kept for API-consistency. */
  variant?: "page" | "sheet";
}) {
  void variant;
  const [state, formAction] = useActionState(addHouseholdMemberAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="อีเมลของสมาชิก" htmlFor="email">
        <Input id="email" name="email" type="email" placeholder="ต้องเป็นอีเมลที่สมัครสมาชิกไว้แล้ว" required />
      </Field>
      <Field label="บทบาท" htmlFor="role">
        <Select id="role" name="role" defaultValue="member">
          <option value="member">สมาชิก</option>
          {canInviteAdmin ? <option value="admin">ผู้ดูแล</option> : null}
        </Select>
      </Field>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="md">เพิ่มสมาชิก</SubmitButton>
    </form>
  );
}
