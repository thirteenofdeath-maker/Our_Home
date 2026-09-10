"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/types/action-state";
import { initialActionState } from "@/lib/types/action-state";

import type { ButtonProps } from "./Button";
import { SubmitButton } from "./SubmitButton";

/**
 * A single-button form whose Server Action can genuinely fail for a
 * business reason the user must see (e.g. "archive rejected — balance
 * isn't zero"). Reused across Wallet/Pocket archive & delete instead of
 * writing a near-identical `useActionState` wrapper for each — the
 * action itself is the only thing that differs.
 */
export function ActionButton({
  action,
  hiddenFields,
  label,
  variant,
  className,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields: Record<string, string>;
  label: string;
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton size="md" variant={variant} className={className ?? "w-auto px-3 text-xs"}>
        {label}
      </SubmitButton>
      {state.error ? <p className="max-w-48 text-right text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
