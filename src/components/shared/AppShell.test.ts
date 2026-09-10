import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/shared/AppShell.tsx"), "utf8");

describe("AppShell visibility", () => {
  it("limits full app chrome to exact top-level destinations", () => {
    expect(source).toContain('new Set(["/finance", "/pets", "/calendar", "/household"])');
    expect(source).toContain("TOP_LEVEL_ROUTES.has(pathname)");
    expect(source).not.toContain("startsWith");
  });

  it("hands the finance quick add to BottomNav as a center action, not a separate floating element", () => {
    // BottomNav itself decides whether /finance is the active route (see
    // BottomNav.test.ts) — AppShell's job is only to wire the prop through.
    expect(source).toContain("<BottomNav centerAction={financeQuickAdd} />");
    expect(source).toContain("isTopLevel ?");
    expect(source).not.toMatch(/pathname === "\/finance" \? financeQuickAdd/);
  });
});
