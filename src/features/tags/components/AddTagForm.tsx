"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { createTagAction } from "../actions";

export function AddTagForm({ scope }: { scope: "PERSONAL" | "HOUSEHOLD" }) {
  const [state, formAction] = useActionState(createTagAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <input type="hidden" name="scope" value={scope} />
      <Field label="ชื่อแท็ก" htmlFor="name">
        <Input id="name" name="name" type="text" placeholder="เช่น เที่ยว" required />
      </Field>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="md">เพิ่มแท็ก</SubmitButton>
    </form>
  );
}
