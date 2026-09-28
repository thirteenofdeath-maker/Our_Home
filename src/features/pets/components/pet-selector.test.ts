import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/features/pets/components/PetSelector.tsx",
  "utf8",
);

describe("PetSelector", () => {
  it("keeps the selected pet visible after navigation", () => {
    expect(source).toContain("selected.scrollIntoView");
    expect(source).toContain('inline: "center"');
  });

  it("supports touch, keyboard and explicit horizontal controls", () => {
    expect(source).toContain("touch-pan-x");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("เลื่อนไปทางซ้าย");
    expect(source).toContain("เลื่อนไปทางขวา");
  });
});
