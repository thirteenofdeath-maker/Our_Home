import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile visual foundation", () => {
  it("uses one Cozy palette across the app and offline shell", () => {
    const css = read("src/app/globals.css");
    const layout = read("src/app/layout.tsx");
    const manifest = read("src/app/manifest.ts");
    const offline = read("public/offline.html");
    expect(css).toContain("--cozy-background: #fff9ef");
    expect(css).toContain("--cozy-surface: #fffdf8");
    expect(css).toContain("--cozy-primary: #607a65");
    expect(css).toContain("--finance-hero: var(--cozy-primary)");
    expect(css).toContain("--color-finance-hero: var(--finance-hero)");
    expect(css).toContain(
      "--color-finance-primary-foreground: var(--finance-primary-foreground)",
    );
    expect(css).not.toContain("data-time-theme");
    expect(layout).not.toContain("TimeThemeController");
    expect(layout).not.toContain("timeThemeBootstrap");
    expect(layout).toContain('themeColor: "#607a65"');
    expect(manifest).toContain('theme_color: "#607a65"');
    expect(manifest).toContain('background_color: "#fff9ef"');
    expect(offline).toContain('name="theme-color" content="#607a65"');
    expect(offline).toContain("background: #fff9ef");
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
    const fab = read("src/components/ui/fab.ts");
    expect(fab).toContain("app-fab");

    for (const path of [
      "src/features/finance/components/FinanceCreateFlow.tsx",
      "src/features/calendar/components/AddCalendarEventFab.tsx",
      "src/features/pets/components/AddPetFab.tsx",
      "src/app/(app)/household/page.tsx",
    ]) {
      expect(read(path), path).toContain("APP_FAB_CLASSNAME");
    }
  });

  it("applies the shared Cozy treatment to each main-page cover", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".app-cover-overlay");
    expect(css).toContain("var(--cozy-cover-overlay-start)");

    for (const path of [
      "src/app/(app)/page.tsx",
      "src/features/finance/components/FinanceHeader.tsx",
      "src/features/plan/components/PlanHeader.tsx",
      "src/app/(app)/pets/page.tsx",
      "src/app/(app)/household/page.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("app-cover");
      expect(source, path).toContain("app-cover-image");
      expect(source, path).toContain("app-cover-overlay");
    }
  });

  it("art-directs every cover separately for iPhone and iPad crops", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain("@media (min-width: 700px)");
    for (const className of [
      ".app-cover-home .app-cover-image",
      ".app-cover-finance .app-cover-image",
      ".app-cover-calendar .app-cover-image",
      ".app-cover-pets .app-cover-image",
      ".app-cover-household .app-cover-image",
    ]) {
      expect(
        css.match(new RegExp(className.replaceAll(".", "\\."), "g"))?.length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("limits the time override to Home artwork", () => {
    const layout = read("src/app/layout.tsx");
    const home = read("src/app/(app)/page.tsx");
    expect(layout).not.toContain("timeTheme");
    expect(home).toContain(
      "parseHomeCoverTime((await searchParams).timeTheme)",
    );
    expect(home).toContain("coverOverride ?? homeCoverMode");
    expect(home).not.toContain("ป้ายช่วงเวลา");
  });

  it("uses distinct tablet and wide split-view systems without duplicating routes", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(
      "@media (min-width: 700px) and (orientation: portrait)",
    );
    expect(css).toContain(
      "(min-width: 700px) and (max-width: 1023px) and (min-height: 600px)",
    );
    expect(css).toContain(
      "@media (orientation: landscape) and (min-width: 1024px)",
    );
    expect(css).toContain("max-width: 52rem");
    expect(css).toContain("max-width: 90rem");
    expect(css).toContain("max-width: 44rem");
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
    expect(css).toMatch(
      /\.app-cover\s*\{[\s\S]*?height:\s*11\.5rem !important;/,
    );

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
      "landscape-household-columns",
    ]) {
      expect(sources).toContain(className);
    }

    const householdPage = read("src/app/(app)/household/page.tsx");
    expect(householdPage).toContain(
      "mt-auto flex w-fit items-center gap-1.5 rounded-full",
    );
    expect(css).not.toContain(".landscape-household-info {\n    grid-row: 2;");
    expect(css).not.toContain(
      ".landscape-household-column {\n    position: sticky",
    );
    expect(css).not.toContain("touch-action: pan-y");
    expect(css).not.toContain(
      "height: calc(100dvh - 2.25rem);\n    grid-template-rows",
    );
    expect(css).toContain(".landscape-plan-detail > a > .shadow-card");
    expect(css).toContain(".landscape-household-info > .shadow-card");
    expect(css).toContain("padding: 1.25rem");

    expect(read("src/components/shared/AppShell.tsx")).toContain("app-main");
    expect(read("src/components/shared/BottomNav.tsx")).toContain(
      "bottom-nav-shell",
    );
    expect(read("src/components/ui/BottomSheet.tsx")).toContain(
      "app-bottom-sheet",
    );
  });

  it("keeps every landscape nav item reachable when browser chrome reduces height", () => {
    const css = read("src/app/globals.css");
    const nav = read("src/components/shared/BottomNav.tsx");
    expect(css).toMatch(
      /\.bottom-nav-shell\s*\{[\s\S]*?top:\s*50%;[\s\S]*?height:\s*min\([\s\S]*?34rem,[\s\S]*?100dvh[\s\S]*?transform:\s*translateY\(-50%\);/,
    );
    expect(css).toMatch(
      /\.bottom-nav-list\s*\{[\s\S]*?justify-content:\s*safe center;[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(css).toContain("-webkit-overflow-scrolling: touch");
    expect(css).toContain(".bottom-nav-list::-webkit-scrollbar");
    expect(css).toContain("@media (max-height: 27rem)");
    expect(nav).toContain("overflow-x-hidden");
    expect(nav).not.toContain("gap-1 overflow-hidden");
  });

  it("keeps the four real destinations and gives each an icon", () => {
    const nav = read("src/components/shared/BottomNav.tsx");
    expect(nav.match(/href: "\/(?:calendar|pets|household)?"/g)).toHaveLength(
      4,
    );
    expect(nav).toContain("<AppIcon");
  });
});
