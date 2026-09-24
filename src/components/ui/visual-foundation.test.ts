import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile visual foundation", () => {
  it("uses all seven approved Bangkok-time palettes as shared tokens", () => {
    const css = read("src/app/globals.css").toLowerCase();
    for (const value of [
      "#fff9ef",
      "#fff4e8",
      "#fff3e2",
      "#fff7d1",
      "#ffd6c6",
      "#081c30",
      "#061523",
      "#789b63",
      "#e96c55",
    ])
      expect(css).toContain(value);
    expect(css).toContain("--finance-hero: var(--time-primary)");
    expect(css).toContain("--color-finance-hero: var(--finance-hero)");
    expect(css).toContain(
      "--color-finance-primary-foreground: var(--finance-primary-foreground)",
    );
  });

  it("uses shared soft cards and grouped controls", () => {
    expect(read("src/components/ui/Card.tsx")).toContain("shadow-card");
    expect(read("src/components/ui/Field.tsx")).toContain(
      "focus:ring-3 focus:ring-primary-soft",
    );
  });

  it("keeps fixed quick-add actions aligned to the centered app column on tablets", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".app-fab");
    expect(css).toContain("calc((100vw - 36rem) / 2 + 1.25rem)");

    for (const path of [
      "src/features/finance/components/FinanceCreateFlow.tsx",
      "src/features/calendar/components/AddCalendarEventFab.tsx",
      "src/features/pets/components/AddPetFab.tsx",
      "src/app/(app)/household/page.tsx",
    ]) {
      expect(read(path), path).toContain("app-fab");
    }
  });

  it("ties every static main-page cover to the shared Bangkok-time palette", () => {
    const css = read("src/app/globals.css");
    for (const token of [
      "--time-cover-surface",
      "--time-cover-overlay-start",
      "--time-cover-image-filter",
      "--time-cover-text",
      "--time-cover-muted",
      "--time-cover-accent",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain(".time-cover-overlay");
    expect(css).toContain('html[data-time-theme="night"]');
    expect(css).toContain('html[data-time-theme="late-night"]');

    for (const path of [
      "src/features/finance/components/FinanceHeader.tsx",
      "src/app/(app)/calendar/page.tsx",
      "src/app/(app)/pets/page.tsx",
      "src/app/(app)/household/page.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("time-cover");
      expect(source, path).toContain("time-cover-image");
      expect(source, path).toContain("time-cover-overlay");
    }
  });

  it("uses one landscape-only split-view system without duplicating routes", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(
      "@media (orientation: landscape) and (min-width: 700px)",
    );
    for (const className of [
      ".bottom-nav-shell",
      ".app-bottom-sheet",
      ".landscape-plan-split",
      ".landscape-finance-grid",
      ".landscape-pets-split",
      ".landscape-home-grid",
      ".landscape-household-grid",
    ]) {
      expect(css).toContain(className);
    }

    const sources = [
      read("src/features/calendar/components/MonthCalendar.tsx"),
      read("src/app/(app)/finance/page.tsx"),
      read("src/app/(app)/pets/page.tsx"),
      read("src/app/(app)/page.tsx"),
      read("src/app/(app)/household/page.tsx"),
    ].join("\n");
    for (const className of [
      "landscape-plan-split",
      "landscape-finance-grid",
      "landscape-pets-split",
      "landscape-home-grid",
      "landscape-household-grid",
    ]) {
      expect(sources).toContain(className);
    }

    expect(read("src/components/shared/AppShell.tsx")).toContain("app-main");
    expect(read("src/components/shared/BottomNav.tsx")).toContain(
      "bottom-nav-shell",
    );
    expect(read("src/components/ui/BottomSheet.tsx")).toContain(
      "app-bottom-sheet",
    );
  });

  it("keeps the five real destinations and gives each an icon", () => {
    const nav = read("src/components/shared/BottomNav.tsx");
    expect(
      nav.match(/href: "\/(?:finance|calendar|pets|household)?"/g),
    ).toHaveLength(5);
    expect(nav).toContain("<AppIcon");
  });
});
