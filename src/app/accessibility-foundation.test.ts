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
  it.each([
    ["เช้า", "#685f58", "#fff9ef"],
    ["สาย", "#675f57", "#fff4e8"],
    ["เที่ยง", "#6e6158", "#fff3e2"],
    ["บ่าย", "#6f6257", "#fff7d1"],
    ["เย็น", "#72584f", "#ffd6c6"],
    ["ค่ำ", "#dce4ea", "#081c30"],
    ["ดึก", "#dce4ea", "#061523"],
  ])("keeps %s muted copy at WCAG AA contrast", (_, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["#607a65", "#ffffff"],
    ["#6f7653", "#ffffff"],
    ["#7c6c4f", "#ffffff"],
    ["#7e6b4c", "#ffffff"],
    ["#715348", "#ffffff"],
    ["#f2d8b5", "#20364a"],
    ["#dce4ea", "#061523"],
  ])("keeps primary actions readable", (background, foreground) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
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
