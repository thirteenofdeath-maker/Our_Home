import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const source = read("src/components/shared/AppShell.tsx");

describe("AppShell visibility", () => {
  it("limits the full app chrome (top 'Our Home' header) to the exact four top-level roots only", () => {
    expect(source).toContain('new Set(["/finance", "/pets", "/calendar", "/household"])');
    expect(source).toContain("TOP_LEVEL_ROUTES.has(pathname)");
    expect(source).toContain("isTopLevel ? globalHeader : null");
  });

  it("persists BottomNav across an entire module's tree (startsWith), not just each module's own root page", () => {
    expect(source).toContain("MODULE_PREFIXES");
    expect(source).toMatch(/pathname\.startsWith\(`\$\{prefix\}\/`\)/);
    expect(source).toContain("{inModule ? <BottomNav /> : null}");
    // BottomNav no longer takes a centerAction prop at all.
    expect(source).not.toMatch(/<BottomNav\s+centerAction/);
  });

  it("renders the generic Finance quick-add FAB only on Finance routes with no module-specific creation action of their own", () => {
    expect(source).toContain('new Set(["/finance", "/finance/reports", "/finance/net-worth"])');
    expect(source).toContain("FINANCE_GENERIC_FAB_ROUTES.has(pathname)");
    expect(source).not.toContain("/finance/budgets");
    expect(source).not.toContain("/finance/goals");
  });

  it("gives every in-module route enough bottom padding to clear BottomNav + a FAB + the real safe-area inset — never a plain fixed guess", () => {
    expect(source).toMatch(/pb-\[calc\(env\(safe-area-inset-bottom\)\+\d+rem\)\]/);
  });

  it("keeps the padding numerically ahead of the FAB's own top edge, with a real margin — verified against a live scroll-to-bottom measurement (~84px clearance) at the current values", () => {
    // The tallest fixed obstruction on any in-module page is a FAB's own
    // top edge: FAB bottom-offset + FAB diameter (size-14 = 3.5rem).
    // AppShell's bottom padding must clear that by a real margin (≥1rem
    // ≈ 16px), or a deep form's last control can sit visually under the
    // FAB/BottomNav on a real device. FloatingActionButton.tsx no longer
    // exists (every single-create FAB now composes FormSheetButton/
    // AsyncFormSheetButton directly) — FinanceCreateFlow's own FAB uses
    // the same shared offset every other converted FAB copies verbatim.
    const fabSource = read("src/features/finance/components/FinanceCreateFlow.tsx");
    const fabOffsetMatch = fabSource.match(/bottom-\[calc\(env\(safe-area-inset-bottom\)\+([\d.]+)rem\)\]/);
    expect(fabOffsetMatch).not.toBeNull();
    const fabOffsetRem = Number(fabOffsetMatch![1]);
    const fabDiameterRem = 3.5; // size-14

    const paddingMatch = source.match(/pb-\[calc\(env\(safe-area-inset-bottom\)\+(\d+)rem\)\]/);
    expect(paddingMatch).not.toBeNull();
    const paddingRem = Number(paddingMatch![1]);

    const fabTopEdgeRem = fabOffsetRem + fabDiameterRem;
    expect(paddingRem, `padding (${paddingRem}rem) must clear the FAB's top edge (${fabTopEdgeRem}rem) by ≥1rem`).toBeGreaterThanOrEqual(fabTopEdgeRem + 1);
  });
});
