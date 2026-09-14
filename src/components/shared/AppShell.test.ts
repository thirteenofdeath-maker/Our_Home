import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
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
      globalHeader: createElement("header", null, "hdr"),
      children: createElement("p", null, "content"),
    }),
  );
  /* eslint-enable react/no-children-prop */
}

describe("AppShell visibility", () => {
  it("limits the full app chrome (top 'Our Home' header) to the exact four top-level roots only", () => {
    expect(source).toContain('new Set(["/finance", "/pets", "/calendar", "/household"])');
    expect(source).toContain("TOP_LEVEL_ROUTES.has(pathname)");
    expect(source).toContain("isTopLevel ? globalHeader : null");
  });

  it("persists BottomNav across the entire authenticated app (every section, any depth) via the shared appSectionForPath classifier — not a locally-duplicated prefix list", () => {
    expect(source).toContain('import { appSectionForPath } from "@/lib/navigation/app-section"');
    expect(source).toMatch(/appSectionForPath\(pathname\)\s*!==\s*"onboarding"/);
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
    const walletsPadding = wallets.match(/pb-\[calc\(env\(safe-area-inset-bottom\)\+\d+rem\)\]/)?.[0];
    const financePadding = finance.match(/pb-\[calc\(env\(safe-area-inset-bottom\)\+\d+rem\)\]/)?.[0];
    expect(walletsPadding).not.toBeUndefined();
    expect(walletsPadding).toBe(financePadding);
  });

  it("never mounts a global Finance quick-add FAB", () => {
    expect(source).not.toContain("FINANCE_GENERIC_FAB_ROUTES");
    expect(source).not.toContain("financeQuickAdd");
    expect(source).not.toContain("/finance/goals");
  });

  it("gives every in-module route enough bottom padding to clear BottomNav + a FAB + the real safe-area inset — never a plain fixed guess", () => {
    expect(source).toMatch(/pb-\[calc\(env\(safe-area-inset-bottom\)\+\d+rem\)\]/);
  });

  it("keeps generous safe-area clearance below page content", () => {
    const paddingMatch = source.match(/pb-\[calc\(env\(safe-area-inset-bottom\)\+(\d+)rem\)\]/);
    expect(paddingMatch).not.toBeNull();
    const paddingRem = Number(paddingMatch![1]);
    expect(paddingRem).toBeGreaterThanOrEqual(6);
  });
});
