import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function rgb(hex: string) {
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
}

function luminance(hex: string) {
  const channels = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("accessibility foundation", () => {
  it("keeps small-text palette colors at WCAG AA contrast", () => {
    expect(contrast("#66706a", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#58745e", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#706963", "#fbf8f2")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#607a65", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("does not disable browser zoom", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).not.toContain("maximumScale");
    expect(layout).not.toContain("userScalable: false");
  });
});
