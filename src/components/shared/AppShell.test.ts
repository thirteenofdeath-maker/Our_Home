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

  it("shows the global finance quick add only on finance home", () => {
    expect(source).toContain('pathname === "/finance" ? financeQuickAdd : null');
    expect(source).toContain("isTopLevel ? <BottomNav /> : null");
  });
});
