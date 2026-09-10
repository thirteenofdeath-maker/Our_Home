"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Mobile-style bottom sheet built on the native <dialog> element (built-in
 * focus trapping, Escape-to-close, and backdrop — no extra dependency
 * needed for this milestone).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-lg rounded-t-sheet border-0 bg-surface p-0 pb-[env(safe-area-inset-bottom)] backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
    </dialog>
  );
}
