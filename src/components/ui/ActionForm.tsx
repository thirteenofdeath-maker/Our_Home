"use client";

import { useActionState, type ReactNode } from "react";

import type { ActionState } from "@/lib/types/action-state";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, submit, pending] = useActionState(
    async (_previous: ActionState, form: FormData) => action(form),
    {},
  );
  return (
    <form action={submit} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
