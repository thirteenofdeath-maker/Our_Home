import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile visual foundation", () => {
  it("uses the approved warm sage palette as shared tokens", () => {
    const css = read("src/app/globals.css").toLowerCase();
    for (const value of ["#f5f3ee", "#ffffff", "#718d7a", "#dde8df", "#dce6ee", "#39413d", "#88918c", "#789b63", "#e96c55"]) expect(css).toContain(value);
    expect(css).toContain("--finance-hero: #49675a");
    expect(css).toContain("--color-finance-hero: var(--finance-hero)");
  });

  it("uses shared soft cards and grouped controls", () => {
    expect(read("src/components/ui/Card.tsx")).toContain("shadow-card");
    expect(read("src/components/ui/Field.tsx")).toContain("focus:ring-3 focus:ring-primary-soft");
  });

  it("keeps the four real destinations and gives each an icon", () => {
    const nav = read("src/components/shared/BottomNav.tsx");
    expect(nav.match(/href: "\/(?:finance|pets|calendar|household)"/g)).toHaveLength(4);
    expect(nav).toContain("<AppIcon");
  });
});
