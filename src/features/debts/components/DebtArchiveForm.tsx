"use client";

import { useActionState } from "react";

import { initialActionState } from "@/lib/types/action-state";

import { setDebtArchivedAction } from "../actions";

export function DebtArchiveForm({
  debtId,
  archived,
}: {
  debtId: string;
  archived: boolean;
}) {
  const [state, formAction] = useActionState(
    setDebtArchivedAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="debtId" value={debtId} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <button className="min-h-11 text-primary" type="submit">
        {archived ? "นำกลับมาใช้" : "เก็บถาวร"}
      </button>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
