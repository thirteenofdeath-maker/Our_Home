"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * The single-create counterpart to a navigation menu trigger: for a trigger
 * with exactly ONE creation type, the form itself slides up directly —
 * no redundant one-item choice screen in between (see the task's own
 * "do not force a redundant one-item choice sheet" rule). Composes the
 * same BottomSheet (`size="large"`, i.e. up to ~88dvh — a real form
 * needs more room than a compact action list), never a second modal
 * implementation.
 *
 * `form` is a plain `ReactNode` — an already-constructed element (e.g.
 * `<WalletForm ... variant="sheet" />`), NEVER a function. This is
 * deliberate: a Server Component (most of this component's real callers
 * — page.tsx files with data already fetched) is allowed to pass a
 * rendered JSX element as a prop into a Client Component (the element is
 * part of the serializable RSC payload), but is NOT allowed to pass an
 * arbitrary callback/render-prop function — Next.js throws "Functions
 * cannot be passed directly to Client Components" at runtime the moment
 * that boundary is crossed. An earlier version of this component took
 * `renderForm: () => ReactNode`, which happened to work only for the
 * `"use client"` callers and broke at runtime for every Server Component
 * caller (e.g. `/wallets`, `/household`) — this component owns no
 * domain/business logic itself either way, so passing the element
 * directly costs nothing.
 */
export function FormSheetButton({
  triggerClassName,
  ariaLabel,
  children,
  sheetTitle,
  form,
  tone = "default",
}: {
  triggerClassName: string;
  ariaLabel?: string;
  /** The trigger button's own visible content (icon/label) — not the sheet's form. */
  children: ReactNode;
  sheetTitle: string;
  /** The form to render inside the sheet — a plain element, not a render-prop function. */
  form: ReactNode;
  /** Pass "finance" for any Finance creation form — self-contained (see
   * BottomSheet's own `tone` doc), works whether or not the trigger's
   * page is itself wrapped in `.finance-scope`. */
  tone?: "default" | "finance";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={ariaLabel} className={triggerClassName}>
        {children}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={sheetTitle} size="large" tone={tone}>
        {form}
      </BottomSheet>
    </>
  );
}
