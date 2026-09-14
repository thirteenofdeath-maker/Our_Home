"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * The single-create counterpart to FormSheetButton for a form whose
 * supporting data (wallets/pockets/categories/tags, etc.) isn't already
 * on hand at the trigger's call site and must be fetched JIT — the same
 * "fetch only when the sheet actually opens, not on every page load"
 * principle FinanceCreateFlow/quick-add-data.ts already established.
 * `loadData` is a `"use server"` function (called directly from this
 * Client Component, no full-page navigation), mirroring the exact
 * selectors the equivalent full-page `/new` route already uses — never a
 * new/duplicated query.
 *
 * Composes the same BottomSheet as FormSheetButton (never a second sheet/
 * motion implementation). Data is discarded on close so the next open
 * re-fetches fresh (wallets/categories can change between opens).
 *
 * `renderForm: (data: T) => ReactNode` is a genuine callback here — data
 * only exists after the client-side JIT fetch resolves, so unlike
 * FormSheetButton's `form` prop this literally cannot be a pre-built
 * element. This is safe ONLY because every real consumer of this
 * component is itself a small `"use client"` wrapper (e.g.
 * AddBudgetFab.tsx) that constructs the callback and passes it to this
 * (also client) component — a same-runtime function reference, never
 * serialized across the Server→Client RSC boundary. NEVER instantiate
 * `<AsyncFormSheetButton renderForm={...}>` directly from a Server
 * Component (a page.tsx with no "use client") — that throws "Functions
 * cannot be passed directly to Client Components" at runtime, exactly
 * like FormSheetButton's old `renderForm` prop did. Always go through a
 * dedicated client trigger component instead.
 */
export function AsyncFormSheetButton<T>({
  triggerClassName,
  ariaLabel,
  children,
  sheetTitle,
  tone = "default",
  loadData,
  renderForm,
}: {
  triggerClassName: string;
  ariaLabel?: string;
  children: ReactNode;
  sheetTitle: string;
  tone?: "default" | "finance";
  loadData: () => Promise<T>;
  renderForm: (data: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setError(null);
    startTransition(async () => {
      try {
        setData(await loadData());
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setData(null);
    setError(null);
  }

  return (
    <>
      <button type="button" onClick={handleOpen} aria-label={ariaLabel} className={triggerClassName}>
        {children}
      </button>
      <BottomSheet open={open} onClose={handleClose} title={sheetTitle} size="large" tone={tone}>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!error && !data ? <p className="text-sm text-foreground-muted">{isPending ? "กำลังโหลด..." : null}</p> : null}
        {data ? renderForm(data) : null}
      </BottomSheet>
    </>
  );
}
