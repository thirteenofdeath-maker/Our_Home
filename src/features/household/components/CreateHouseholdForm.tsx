"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { createHouseholdAction } from "../actions";

export function CreateHouseholdForm() {
  const [state, formAction] = useActionState(createHouseholdAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="ชื่อครอบครัว" htmlFor="name">
        <Input id="name" name="name" type="text" placeholder="เช่น บ้านของเรา" required autoFocus />
      </Field>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">สร้างครอบครัว</SubmitButton>
    </form>
  );
}
