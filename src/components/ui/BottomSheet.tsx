"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Mobile-style bottom sheet built on the native <dialog> element (built-in
 * focus trapping, Escape-to-close, and backdrop — no extra dependency
 * needed for this milestone).
 *
 * Sized with `dvh` (dynamic viewport height), not `vh` — on iOS Safari,
 * `vh` is computed against the LARGEST possible viewport (as if the
 * address bar/bottom toolbar were always hidden), so a `max-h-[75vh]`
 * sheet can end up taller than the ACTUALLY visible area whenever that
 * browser chrome is showing, pushing its lower content (including the
 * primary action button) behind it. `dvh` tracks the real, currently
 * visible viewport instead. The dialog itself (header + content) is
 * capped by `max-h`, with only the content region scrolling internally
 * — the header always stays visible and reachable.
 *
 * IMPORTANT: the layout below is `open:flex`, never a bare `flex`. The
 * browser's own UA stylesheet hides a <dialog> via `dialog:not([open])
 * { display: none }`, which is an ordinary (non-`!important`) rule — any
 * unconditional author `display` utility on the <dialog> itself (a plain
 * `flex`, `block`, etc.) permanently overrides it regardless of the
 * `open` attribute, making the sheet's content render as a fixed,
 * always-visible overlay that covers the underlying page even while
 * "closed". `open:flex` (Tailwind's `[open]:` attribute variant) only
 * ever sets `display: flex` once `.showModal()` has actually added the
 * `open` attribute, so the UA rule is free to hide it the rest of the
 * time. This exact regression shipped in an earlier pass here — see
 * BottomSheet.test.ts for the guard against it recurring.
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
      className="fixed inset-x-0 bottom-0 top-auto m-0 hidden max-h-[88dvh] w-full max-w-lg open:flex flex-col rounded-t-sheet border-0 bg-surface p-0 pb-[env(safe-area-inset-bottom)] backdrop:bg-black/40"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
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
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </dialog>
  );
}
