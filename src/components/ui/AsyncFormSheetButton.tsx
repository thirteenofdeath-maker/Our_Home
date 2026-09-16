"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { FormSheetCloseProvider } from "@/components/ui/FormSheetButton";

/**
 * The single-create counterpart to FormSheetButton for a form whose
 * supporting data (wallets/pockets/categories/tags, etc.) isn't already
 * on hand at the trigger's call site. Its small selector payload is warmed
 * shortly after hydration, without blocking the page, then reused for the
 * lifetime of this trigger. If the user taps before warming has completed,
 * the sheet still paints immediately with a loading state.
 * `loadData` is a `"use server"` function (called directly from this
 * Client Component, no full-page navigation), mirroring the exact
 * selectors the equivalent full-page `/new` route already uses — never a
 * new/duplicated query.
 *
 * Composes the same BottomSheet as FormSheetButton (never a second sheet/
 * motion implementation). Data remains cached after close so subsequent
 * opens are instant; the form subtree still remounts to clear local inputs.
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
  const [formKey, setFormKey] = useState(0);
  const dataRef = useRef<T | null>(null);
  const requestRef = useRef<Promise<T> | null>(null);
  const loadDataRef = useRef(loadData);
  const mountedRef = useRef(true);

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const ensureData = useCallback(async () => {
    if (dataRef.current) return dataRef.current;
    requestRef.current ??= loadDataRef.current();
    try {
      const loaded = await requestRef.current;
      dataRef.current = loaded;
      if (mountedRef.current) setData(loaded);
      return loaded;
    } finally {
      requestRef.current = null;
    }
  }, []);

  // Each async create trigger is the only FAB for its page. Warm its small
  // selector payload just after hydration so the first tap can paint the real
  // form immediately, while leaving the main page's initial render unblocked.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void ensureData().catch(() => {
        // A background warm-up failure is intentionally silent. Opening the
        // sheet retries and surfaces the actionable error there.
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [ensureData]);

  function handleOpen() {
    setOpen(true);
    setError(null);
    startTransition(async () => {
      try {
        await ensureData();
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setError(null);
    setFormKey((current) => current + 1);
  }

  return (
    <>
      <button type="button" onClick={handleOpen} aria-label={ariaLabel} className={triggerClassName}>
        {children}
      </button>
      <BottomSheet open={open} onClose={handleClose} title={sheetTitle} size="large" tone={tone}>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!error && !data ? <p className="text-sm text-foreground-muted">{isPending ? "กำลังโหลด..." : null}</p> : null}
        {data ? (
          <FormSheetCloseProvider key={formKey} onClose={handleClose}>
            {renderForm(data)}
          </FormSheetCloseProvider>
        ) : null}
      </BottomSheet>
    </>
  );
}
