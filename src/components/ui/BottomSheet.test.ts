import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

import { handleOwnDialogLifecycle } from "./BottomSheet";

const source = readFileSync(resolve(process.cwd(), "src/components/ui/BottomSheet.tsx"), "utf8");

// The dialog's class list is now built via cn(...) (several string-literal
// arguments, some inside a ternary) rather than one literal className
// string, since it needs a size variant and animation-state classes.
// This pulls every quoted string literal out of that call so the tests
// below can still check "does this exact utility class exist anywhere
// the dialog could render" without caring which branch produced it.
function dialogClassCandidates(): string {
  const call = source.match(/<dialog[\s\S]*?className=\{cn\(([\s\S]*?)\)\}/)?.[1] ?? "";
  const literals = [...call.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return literals.join(" ");
}

describe("BottomSheet mobile sizing", () => {
  it("sizes itself with dynamic viewport height (dvh), never plain vh", () => {
    // `vh` on iOS Safari is computed against the LARGEST possible
    // viewport (as if browser chrome were always hidden), so a sheet
    // sized in `vh` can end up taller than what's actually visible
    // whenever that chrome is showing — pushing content (including
    // action buttons) behind it. `dvh` tracks the real visible area.
    const classes = dialogClassCandidates();
    expect(classes).toContain("dvh");
    expect(classes).not.toMatch(/max-h-\[\d+vh\]/);
  });

  it("caps the whole sheet (header + content) so it never grows past the safe viewport band, for both the large and content-sized variants", () => {
    const matches = [...dialogClassCandidates().matchAll(/max-h-\[(\d+)dvh\]/g)].map((m) => Number(m[1]));
    expect(matches.length).toBeGreaterThanOrEqual(2); // "large" and "content" ceilings
    for (const value of matches) {
      expect(value).toBeGreaterThanOrEqual(60);
      expect(value).toBeLessThanOrEqual(88);
    }
    // The default ("large") ceiling stays exactly what it always was.
    expect(matches).toContain(88);
  });

  it("supports a content-sized mode that doesn't force a large/filter-sheet-sized sheet for a short action list", () => {
    expect(source).toContain('size?: "content" | "large"');
    expect(source).toMatch(/size === "large"\s*&&\s*"flex-1"/);
  });

  it("keeps the header always visible and lets only the content region scroll", () => {
    expect(source).toContain("shrink-0"); // header rows never shrink/scroll away
    const classes = dialogClassCandidates();
    expect(classes).not.toContain("overflow-y-auto");
    expect(classes).toContain("flex-col");
    const contentDiv = source.match(/<div className=\{cn\("([^"]*)"/)?.[1] ?? "";
    expect(contentDiv).toContain("overflow-y-auto");
  });

  it("keeps the safe-area bottom inset so the close affordance/actions stay reachable above iOS chrome", () => {
    expect(source).toContain("env(safe-area-inset-bottom)");
  });

  it("closes on a genuine backdrop tap — a native <dialog> does not do this on its own", () => {
    expect(source).toMatch(/onClick=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) onClose\(\);/);
  });

  it("shows a small drag-handle visual at the top of the sheet", () => {
    expect(source).toMatch(/h-1\.5 w-10 rounded-full/);
  });

  // Regression for a real, shipped bug: a <dialog> hides itself when
  // closed via the browser's own `dialog:not([open]) { display: none }`
  // rule — an ordinary (non-!important) UA rule. Putting an unconditional
  // `display`-setting utility (a bare `flex`, `block`, etc.) directly on
  // the <dialog> element permanently overrides that UA rule regardless of
  // the `open` attribute, since any author-origin rule beats a
  // user-agent-origin one — the dialog (and everything inside it) then
  // renders as an always-visible `fixed inset-x-0 bottom-0` overlay that
  // covers the whole page underneath it even while "closed". This
  // shipped once already and made /finance/transactions unusable on a
  // real device.
  it("never sets display unconditionally on the <dialog> — only via the open: variant", () => {
    const classes = dialogClassCandidates().split(/\s+/).filter(Boolean);
    for (const displayUtility of ["flex", "block", "grid", "inline-flex", "inline-block", "inline-grid"]) {
      expect(classes).not.toContain(displayUtility);
    }
    expect(classes).toContain("open:flex");
    expect(classes).toContain("hidden");
  });
});

describe("BottomSheet nested lifecycle isolation", () => {
  it("closing a child sheet does not execute the parent close handler", () => {
    const childDialog = new EventTarget();
    const parentDialog = new EventTarget();
    const childClose = vi.fn();
    const parentClose = vi.fn();
    let propagationStopped = false;

    handleOwnDialogLifecycle(
      {
        target: childDialog,
        currentTarget: childDialog,
        stopPropagation: () => { propagationStopped = true; },
      },
      childClose,
    );
    if (!propagationStopped) {
      handleOwnDialogLifecycle(
        { target: childDialog, currentTarget: parentDialog, stopPropagation: vi.fn() },
        parentClose,
      );
    }

    expect(childClose).toHaveBeenCalledOnce();
    expect(parentClose).not.toHaveBeenCalled();
  });

  it("ignores a descendant dialog event even if it reaches the parent handler", () => {
    const childDialog = new EventTarget();
    const parentClose = vi.fn();
    handleOwnDialogLifecycle(
      { target: childDialog, currentTarget: new EventTarget(), stopPropagation: vi.fn() },
      parentClose,
    );
    expect(parentClose).not.toHaveBeenCalled();
  });

  it("prevents native Escape close so the owning controlled sheet can animate out", () => {
    const dialog = new EventTarget();
    const preventDefault = vi.fn();
    const onClose = vi.fn();
    handleOwnDialogLifecycle(
      { target: dialog, currentTarget: dialog, stopPropagation: vi.fn(), preventDefault },
      onClose,
      true,
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("treats a prop-driven native close as lifecycle completion, not another user-dismiss request", () => {
    const dialog = new EventTarget();
    const onClose = vi.fn();
    const stopPropagation = vi.fn();

    handleOwnDialogLifecycle(
      { target: dialog, currentTarget: dialog, stopPropagation },
      onClose,
      false,
      true,
    );

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still reports a genuine native/user dismiss to the controlled owner", () => {
    const dialog = new EventTarget();
    const onClose = vi.fn();

    handleOwnDialogLifecycle(
      { target: dialog, currentTarget: dialog, stopPropagation: vi.fn() },
      onClose,
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("BottomSheet slide-up animation", () => {
  it("orchestrates the open/close transition via React state (entered), not a new animation dependency", () => {
    expect(source).toContain("useState(false)");
    expect(source).toContain("requestAnimationFrame");
    expect(source).not.toMatch(/from ["'](framer-motion|react-spring|gsap)["']/);
  });

  it("slides up from fully off-screen and fades in when entered, within the ~220-280ms band", () => {
    // An explicit `transform: translate3d(...)`, never Tailwind's own
    // translate-y-* utility — that utility sets the standalone CSS
    // `translate` property, which the `transition-[transform,...]`
    // property list below would NOT animate (transform and translate
    // are separate longhands), and translate3d is the better-tested
    // path for animating a `position: fixed` element on iOS Safari.
    const classes = dialogClassCandidates();
    expect(classes).toContain("[transform:translate3d(0,100%,0)]");
    expect(classes).toContain("[transform:translate3d(0,0,0)]");
    expect(classes).not.toMatch(/\btranslate-y-(0|full)\b/);
    expect(classes).toContain("opacity-0");
    expect(classes).toContain("opacity-100");
    // `transition-property` must actually list `transform` — otherwise
    // the slide silently never animates regardless of which CSS
    // mechanism moves the element.
    expect(classes).toMatch(/transition-\[transform,opacity\]/);
    const duration = source.match(/duration-\[(\d+)ms\]/)?.[1];
    expect(duration).toBeTruthy();
    expect(Number(duration)).toBeGreaterThanOrEqual(220);
    expect(Number(duration)).toBeLessThanOrEqual(280);
  });

  it("fades the backdrop in/out alongside the card", () => {
    const classes = dialogClassCandidates();
    expect(classes).toContain("backdrop:opacity-0");
    expect(classes).toContain("backdrop:opacity-100");
  });

  it("delays the actual dialog.close() until the closing transition has had time to play", () => {
    expect(source).toContain("setTimeout");
    expect(source).toMatch(/dialog\.close\(\)/);
  });

  it("respects prefers-reduced-motion — no transform animation, only (at most) a quick opacity change", () => {
    const classes = dialogClassCandidates();
    expect(classes).toContain("motion-reduce:[transform:translate3d(0,0,0)]");
    expect(classes).toMatch(/motion-reduce:transition-opacity|motion-reduce:transition-none/);
  });
});

describe("BottomSheet tone", () => {
  // `tone` must default to "default" so every pre-existing consumer
  // (ActionSheet, CategoryPicker, TagPicker, FinanceFilterSheet — none of
  // which pass `tone`) renders with the exact same generic --color-*
  // classes as before this prop existed. ConfirmDialog (destructive
  // confirmations) doesn't use BottomSheet at all any more.
  it("defaults to the generic surface/border/foreground-muted tokens, unchanged for existing callers", () => {
    expect(source).toContain('tone = "default"');
    const classes = dialogClassCandidates();
    expect(classes).toContain("bg-surface");
    expect(source).toContain("bg-border");
    expect(source).toContain("text-foreground-muted");
    expect(source).toContain("hover:bg-surface-muted");
  });

  // `tone="finance"` swaps the dialog's own chrome to the --finance-*
  // tokens, for a sheet whose trigger already lives inside a
  // `.finance-scope` ancestor — without this, the sheet itself keeps
  // rendering the generic (and, in dark mode, near-black) surface color
  // even while the finance-scoped page around it stays light, which is
  // the exact "sheet doesn't visually belong" mismatch this exists to fix.
  it("swaps to finance tokens for the dialog surface, handle, title, and close button when tone=\"finance\"", () => {
    expect(source).toContain('tone === "finance" ? "bg-finance-surface" : "bg-surface"');
    expect(source).toContain('tone === "finance" ? "bg-finance-primary-soft" : "bg-border"');
    expect(source).toContain('tone === "finance" && "text-finance-text"');
    expect(source).toContain('tone === "finance" ? "text-finance-muted hover:bg-finance-background"');
  });
});
