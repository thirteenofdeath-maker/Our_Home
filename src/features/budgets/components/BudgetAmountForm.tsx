"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { updateBudgetAmountAction } from "../actions";

export function BudgetAmountForm({ budgetId, currentAmount }: { budgetId: string; currentAmount: string }) {
  const [state, formAction] = useActionState(updateBudgetAmountAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={budgetId} />
      <Field label="งบประมาณ" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" defaultValue={currentAmount} required />
      </Field>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="md">บันทึก</SubmitButton>
    </form>
  );
}
