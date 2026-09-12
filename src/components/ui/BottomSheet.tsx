"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type DialogLifecycleEvent = {
  target: EventTarget | null;
  currentTarget: EventTarget;
  stopPropagation: () => void;
  preventDefault?: () => void;
};

/**
 * React delegates native dialog lifecycle events. When BottomSheets are
 * nested, a child's close/cancel can therefore reach the parent's React
 * handler even though the parent dialog itself did not close. Only the
 * dialog that owns the event may update its controlled open state.
 */
export function handleOwnDialogLifecycle(
  event: DialogLifecycleEvent,
  onClose: () => void,
  preventNativeClose = false,
  suppressCallback = false,
): void {
  if (event.target !== event.currentTarget) return;
  event.stopPropagation();
  if (preventNativeClose) event.preventDefault?.();
  if (!suppressCallback) onClose();
}

/** Time the slide-down/fade-out transition is given before the native
 * dialog actually closes — kept in sync with the `duration-*` class
 * below. Not itself an animation, just sequencing, so it applies
 * regardless of prefers-reduced-motion (only the transform/opacity are
 * gated by that, via the `motion-reduce:` classes below).
 *
 * Exported so any consumer that needs to sequence something AFTER the
 * exit motion (e.g. FinanceCreateFlow delaying its stage swap until the
 * slide-down has had time to play) reads the same single number instead
 * of hard-coding a second "240" that could silently drift out of sync. */
export const CLOSE_TRANSITION_MS = 240;

/**
 * Mobile-style bottom sheet built on the native <dialog> element (built-in
 * focus trapping, Escape-to-close, and backdrop — no extra dependency
 * needed for this milestone, including for the slide-up/fade animation
 * below, which is plain CSS transitions orchestrated by a small bit of
 * React state).
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
 * `size="large"` (default) is the original behavior — a filter/browse
 * sheet that may hold a lot of content, capped at 88dvh and stretching
 * its content region to fill available height. `size="content"` is for
 * a short action sheet (a handful of tap targets): it sizes to its own
 * content instead of reserving near-full-height space, only ever
 * growing up to a lower 70dvh ceiling for the rare very-long case.
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
  size = "large",
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "content" | "large";
  /**
   * `"default"` (unchanged) reads the app's generic `--color-*` tokens —
   * every pre-existing consumer (CategoryPicker, TagPicker,
   * FinanceFilterSheet — destructive confirmations moved to their own
   * centered ConfirmDialog, not BottomSheet, see ConfirmDialog.tsx) keeps
   * rendering exactly as before. `"finance"` puts the `.finance-vars`
   * class (globals.css) directly on the dialog element itself — a class
   * that ONLY defines the `--finance-*` custom properties, no
   * background-color/color of its own, so it never fights the `bg-
   * finance-surface`/`text-finance-text` Tailwind utilities used right
   * below. This makes tone="finance" fully SELF-CONTAINED: it works even
   * when the trigger that opened this sheet isn't nested inside a
   * `.finance-scope` ancestor (`.finance-scope` is the page-level
   * variant of the same token set, used separately) — without this, a
   * finance-toned sheet reached from a non-finance-scoped page would
   * still render the generic surface/border colors (including DARK-mode
   * variants, since finance tone deliberately stays light-only), which
   * is the exact "sheet doesn't visually belong" mismatch this prop
   * exists to close.
   */
  tone?: "default" | "finance";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // A prop-driven close only synchronizes the native dialog with the
  // already-controlled `open=false` state. Its resulting native `close`
  // event is completion notification, not a fresh user-dismiss request.
  // Without this distinction, an internal FinanceCreateFlow stage change
  // can race its reopen timer against `closeFlow()`.
  const controlledClosePendingRef = useRef(false);
  // Drives the slide-up/fade-in vs. slide-down/fade-out transform+opacity
  // — separate from `open` itself so the dialog can stay mounted/open
  // just long enough to actually play the closing transition instead of
  // vanishing instantly.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      // Deferred a frame so the browser paints the "not entered" state
      // first — flip synchronously here and the transition never plays,
      // since the dialog would already show its final position on the
      // very first paint after `open:flex` takes effect.
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }

    // Same reasoning as above, mirrored for the close direction: this
    // must be a callback, never a direct synchronous setState call in
    // the effect body (a bare `setEntered(false)` here is flagged by
    // react-hooks/set-state-in-effect and can cascade renders).
    const raf = requestAnimationFrame(() => setEntered(false));
    const timeout = setTimeout(() => {
      if (dialog.open) {
        controlledClosePendingRef.current = true;
        dialog.close();
      }
    }, CLOSE_TRANSITION_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={(event) => {
        const controlledClose = controlledClosePendingRef.current;
        controlledClosePendingRef.current = false;
        handleOwnDialogLifecycle(event, onClose, false, controlledClose);
      }}
      onCancel={(event) => handleOwnDialogLifecycle(event, onClose, true)}
      // A native <dialog> does NOT close itself on backdrop click. A
      // click that lands on the ::backdrop still fires with `target`
      // equal to the dialog element itself (there's no separate
      // hit-testable node for it) — a click on any real descendant
      // (the sheet's own content) has that descendant as `target`
      // instead, so this only fires for genuine backdrop taps.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 hidden w-full max-w-lg open:flex flex-col rounded-t-sheet border-0 p-0 pb-[env(safe-area-inset-bottom)] backdrop:bg-black/40",
        tone === "finance" && "finance-vars",
        tone === "finance" ? "bg-finance-surface" : "bg-surface",
        size === "large" ? "max-h-[88dvh]" : "max-h-[70dvh]",
        // Slide-up + fade, ~240ms ease-out. Explicit `transform:
        // translate3d(...)` rather than Tailwind's own translate-y-*
        // utility — that utility sets the standalone CSS `translate`
        // property, not `transform`, which (a) our `transition-property`
        // list below would then silently fail to animate at all (it
        // lists `transform`, and transitioning `transform` does not
        // transition the separate `translate` property), and (b)
        // `transform`/translate3d is the better-tested path for a
        // `position: fixed` element animating on iOS Safari — no height
        // animation involved, so Safari's dynamic toolbar resizing the
        // viewport never makes this jump.
        "transition-[transform,opacity] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity motion-reduce:duration-150",
        "backdrop:transition-opacity backdrop:duration-[240ms] motion-reduce:backdrop:duration-150",
        // `entered` only ever becomes true once `open` is true (see the
        // effect below), so it alone is enough to pick the resting
        // transform — no need to additionally gate on the `open:` variant.
        entered
          ? "[transform:translate3d(0,0,0)] opacity-100 backdrop:opacity-100"
          : "[transform:translate3d(0,100%,0)] opacity-0 backdrop:opacity-0",
        "motion-reduce:[transform:translate3d(0,0,0)]",
      )}
    >
      <div className="flex shrink-0 items-center justify-center pt-2.5 pb-1">
        <span aria-hidden="true" className={cn("h-1.5 w-10 rounded-full", tone === "finance" ? "bg-finance-primary-soft" : "bg-border")} />
      </div>
      <div className="flex shrink-0 items-center justify-between px-4 pb-3">
        <h2 className={cn("text-base font-semibold", tone === "finance" && "text-finance-text")}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex size-11 items-center justify-center rounded-full",
            tone === "finance" ? "text-finance-muted hover:bg-finance-background" : "text-foreground-muted hover:bg-surface-muted",
          )}
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      <div className={cn("overflow-y-auto p-4", size === "large" && "flex-1")}>{children}</div>
    </dialog>
  );
}
