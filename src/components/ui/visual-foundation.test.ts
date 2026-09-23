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

  it("keeps the five real destinations and gives each an icon", () => {
    const nav = read("src/components/shared/BottomNav.tsx");
    expect(
      nav.match(/href: "\/(?:finance|calendar|pets|household)?"/g),
    ).toHaveLength(5);
    expect(nav).toContain("<AppIcon");
  });
});
