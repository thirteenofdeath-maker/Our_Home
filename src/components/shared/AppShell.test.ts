import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const source = read("src/components/shared/AppShell.tsx");

let mockPathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { AppShell } from "./AppShell";

function renderShell(pathname: string): string {
  mockPathname = pathname;
  // AppShell types `children` as a required named prop, and TS's
  // createElement overloads don't merge a positional child into that
  // (unlike real JSX) — passing it via props is the only way this
  // type-checks, hence the targeted lint override below.
  /* eslint-disable react/no-children-prop */
  return renderToStaticMarkup(
    createElement(AppShell, {
      financeQuickAdd: createElement("div", null, "fab"),
      children: createElement("p", null, "content"),
    }),
  );
  /* eslint-enable react/no-children-prop */
}

describe("AppShell visibility", () => {
  it("does not render or accept the removed global Our Home/profile header", () => {
    expect(source).not.toContain("TOP_LEVEL_ROUTES");
    expect(source).not.toContain("globalHeader");
  });

  it("persists BottomNav across the entire authenticated app (every section, any depth) via the shared appSectionForPath classifier — not a locally-duplicated prefix list", () => {
    expect(source).toContain(
      'import { appSectionForPath } from "@/lib/navigation/app-section"',
    );
    expect(source).toMatch(
      /appSectionForPath\(pathname\)\s*!==\s*"onboarding"/,
    );
    expect(source).toContain("{showBottomNav ? <BottomNav /> : null}");
    // BottomNav no longer takes a centerAction prop at all.
    expect(source).not.toMatch(/<BottomNav\s+centerAction/);
  });

  it("shows BottomNav on Finance-owned secondary route families and on neutral routes, hiding it only for Onboarding", () => {
    const finance = renderShell("/wallets/abc/manage");
    expect(finance).toContain("<nav");
    const neutral = renderShell("/profile/edit");
    expect(neutral).toContain("<nav");
    const onboarding = renderShell("/onboarding");
    expect(onboarding).not.toContain("<nav");
  });

  it("gives every route where BottomNav renders the same bottom clearance — never computed per-route, so no page can under-clear it by omission", () => {
    const wallets = renderShell("/wallets/abc/manage");
    const finance = renderShell("/finance");
    const walletsPadding = wallets.match(
      /pb-\[calc\(env\(safe-area-inset-bottom\)\+\d+rem\)\]/,
    )?.[0];
    const financePadding = finance.match(
      /pb-\[calc\(env\(safe-area-inset-bottom\)\+\d+rem\)\]/,
    )?.[0];
    expect(walletsPadding).not.toBeUndefined();
    expect(walletsPadding).toBe(financePadding);
  });

  it("renders the generic Finance quick-add FAB only on Finance routes with no module-specific creation action of their own", () => {
    expect(source).toMatch(
      /FINANCE_GENERIC_FAB_ROUTES\s*=\s*new Set\(\[\s*"\/finance\/net-worth",?\s*\]\)/,
    );
    expect(source).not.toContain('"/finance/reports"');
    expect(source).not.toMatch(
      /FINANCE_GENERIC_FAB_ROUTES[\s\S]{0,120}"\/finance",/,
    );
    expect(source).toContain("FINANCE_GENERIC_FAB_ROUTES.has(pathname)");
    expect(source).not.toContain("/finance/budgets");
    expect(source).not.toContain("/finance/goals");
  });

  it("gives every in-module route enough bottom padding to clear BottomNav + a FAB + the real safe-area inset — never a plain fixed guess", () => {
    expect(source).toMatch(
      /pb-\[calc\(env\(safe-area-inset-bottom\)\+\d+rem\)\]/,
    );
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
    const fabSource = read(
      "src/features/finance/components/FinanceCreateFlow.tsx",
    );
    const fabOffsetMatch = fabSource.match(
      /bottom-\[calc\(env\(safe-area-inset-bottom\)\+([\d.]+)rem\)\]/,
    );
    expect(fabOffsetMatch).not.toBeNull();
    const fabOffsetRem = Number(fabOffsetMatch![1]);
    const fabDiameterRem = 3.5; // size-14

    const paddingMatch = source.match(
      /pb-\[calc\(env\(safe-area-inset-bottom\)\+(\d+)rem\)\]/,
    );
    expect(paddingMatch).not.toBeNull();
    const paddingRem = Number(paddingMatch![1]);

    const fabTopEdgeRem = fabOffsetRem + fabDiameterRem;
    expect(
      paddingRem,
      `padding (${paddingRem}rem) must clear the FAB's top edge (${fabTopEdgeRem}rem) by ≥1rem`,
    ).toBeGreaterThanOrEqual(fabTopEdgeRem + 1);
  });
});
