"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { buttonClassName } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/utils/cn";
import type { ActionState } from "@/lib/types/action-state";
import { initialActionState } from "@/lib/types/action-state";

/** Time the fade/scale-out transition is given before the native dialog
 * actually closes — mirrors BottomSheet's own CLOSE_TRANSITION_MS pattern
 * (a single constant, never re-declared per consumer), just shorter and
 * without a slide, since a centered confirmation card is a fundamentally
 * different, non-creation motion language from the bottom sheet. */
export const CONFIRM_DIALOG_TRANSITION_MS = 160;

/**
 * A centered, native-<dialog>-based confirmation card — deliberately NOT
 * built on BottomSheet. The bottom-sheet slide-up motion is reserved for
 * Create/Add flows (FinanceCreateFlow, FormSheetButton); reusing it for a
 * destructive confirmation (delete, void, skip) made the two visually
 * indistinguishable and risked a fast double-tap turning "look at this
 * choice" into "confirm this destruction". This dialog fades and scales
 * in from the center instead, with a dimmed backdrop — no translate3d
 * bottom-entry motion, no accidental one-tap destructive action.
 *
 * Same underlying mechanism as BottomSheet (native <dialog>, showModal()
 * for focus-trapping/Escape/backdrop-click, `hidden ... open:flex` so the
 * UA's own `dialog:not([open]){display:none}` rule stays in control —
 * see BottomSheet.tsx for why an unconditional `flex`/`block` utility on
 * the dialog itself is a real, previously-shipped bug), just centered
 * instead of bottom-anchored and fade+scale instead of slide+fade.
 *
 * Invokes the EXACT same existing Server Action the caller already had
 * (via useActionState) — never bypasses whatever business-rule rejection
 * that action can return; `state.error` renders inside the card exactly
 * as it did before.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerVariant = "danger",
  triggerClassName,
  sheetTitle,
  description,
  confirmLabel,
  action,
  hiddenFields,
  children,
}: {
  triggerLabel: string;
  triggerVariant?: "danger" | "secondary" | "primary" | "ghost";
  triggerClassName?: string;
  sheetTitle: string;
  description?: string;
  confirmLabel: string;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields: Record<string, string>;
  /** Extra form fields (e.g. a reason text input) rendered above the
   * confirm/cancel row — optional, matches VoidTransactionForm's
   * "เหตุผล" input. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLDialogElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }

    const raf = requestAnimationFrame(() => setEntered(false));
    const timeout = setTimeout(() => {
      if (dialog.open) dialog.close();
    }, CONFIRM_DIALOG_TRANSITION_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName ?? buttonClassName(triggerVariant, "md", "w-auto px-3 text-xs")}>
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        onClose={close}
        onCancel={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className={cn(
          "fixed inset-0 m-auto hidden h-fit w-[calc(100%-2.5rem)] max-w-sm open:flex flex-col rounded-card border-0 bg-surface p-5 shadow-card backdrop:bg-black/40",
          "transition-[transform,opacity] duration-[160ms] ease-out motion-reduce:transition-opacity motion-reduce:duration-100",
          "backdrop:transition-opacity backdrop:duration-[160ms] motion-reduce:backdrop:duration-100",
          entered ? "scale-100 opacity-100 backdrop:opacity-100" : "scale-95 opacity-0 backdrop:opacity-0",
          "motion-reduce:scale-100",
        )}
      >
        <h2 className="text-base font-semibold">{sheetTitle}</h2>
        <form action={formAction} className="mt-2 flex flex-col gap-3">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {description ? <p className="text-sm text-foreground-muted">{description}</p> : null}
          {children}
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={close} className={buttonClassName("secondary", "md", "flex-1")}>
              ยกเลิก
            </button>
            <SubmitButton variant="danger" className="flex-1">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
