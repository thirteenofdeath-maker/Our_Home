import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/ui/BottomSheet.tsx"), "utf8");

describe("BottomSheet mobile sizing", () => {
  it("sizes itself with dynamic viewport height (dvh), never plain vh", () => {
    // `vh` on iOS Safari is computed against the LARGEST possible
    // viewport (as if browser chrome were always hidden), so a sheet
    // sized in `vh` can end up taller than what's actually visible
    // whenever that chrome is showing — pushing content (including
    // action buttons) behind it. `dvh` tracks the real visible area.
    // Checked against the dialog's own className only, since the file's
    // doc comment above legitimately mentions the old `vh` pattern by
    // name as the very thing being fixed.
    const dialogClassName = source.match(/<dialog[\s\S]*?className="([^"]*)"/)?.[1] ?? "";
    expect(dialogClassName).toContain("dvh");
    expect(dialogClassName).not.toMatch(/max-h-\[\d+vh\]/);
  });

  it("caps the whole sheet (header + content) so it never grows past the safe viewport band", () => {
    const maxHeight = source.match(/max-h-\[(\d+)dvh\]/)?.[1];
    expect(maxHeight).toBeTruthy();
    expect(Number(maxHeight)).toBeGreaterThanOrEqual(82);
    expect(Number(maxHeight)).toBeLessThanOrEqual(88);
  });

  it("keeps the header always visible and lets only the content region scroll", () => {
    expect(source).toContain("shrink-0"); // header never shrinks/scrolls away
    // Only the content div (the one actually wrapping {children}) scrolls
    // — the dialog's own class list must not carry overflow-y-auto, or
    // the header would scroll away too.
    const dialogClassName = source.match(/<dialog[\s\S]*?className="([^"]*)"/)?.[1] ?? "";
    expect(dialogClassName).not.toContain("overflow-y-auto");
    expect(dialogClassName).toContain("flex-col");
    const contentDiv = source.match(/<div className="([^"]*)">\{children\}<\/div>/)?.[1] ?? "";
    expect(contentDiv).toContain("overflow-y-auto");
    expect(contentDiv).toContain("flex-1");
  });

  it("keeps the safe-area bottom inset so the close affordance/actions stay reachable above iOS chrome", () => {
    expect(source).toContain("env(safe-area-inset-bottom)");
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
  // shipped once already (introduced by the dvh/flex-column fix above)
  // and made /finance/transactions unusable on a real device.
  it("never sets display unconditionally on the <dialog> — only via the open: variant", () => {
    const dialogClassName = source.match(/<dialog[\s\S]*?className="([^"]*)"/)?.[1] ?? "";
    const classes = dialogClassName.split(/\s+/).filter(Boolean);
    // No bare display-establishing utility (flex/block/grid/inline-*)
    // outside of an `open:`-gated variant.
    for (const displayUtility of ["flex", "block", "grid", "inline-flex", "inline-block", "inline-grid"]) {
      expect(classes).not.toContain(displayUtility);
    }
    expect(classes).toContain("open:flex");
    // And an explicit, unconditional `hidden` as the closed-state default
    // — belt-and-suspenders on top of the browser's own UA rule, not a
    // reliance on it alone.
    expect(classes).toContain("hidden");
  });
});
