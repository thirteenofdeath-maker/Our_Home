import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/(app)/page.tsx"),
  "utf8",
);

describe("Today dashboard composition", () => {
  it("is a read-model dashboard rather than a redirect to wallets", () => {
    expect(source).not.toContain('redirect("/wallets")');
    expect(source).toContain("greetingForBangkok(now)");
    expect(source).toContain("homeCoverMode(profile?.birthday, now)");
    expect(source).toContain("งานวันนี้");
    expect(source).toContain("ปฏิทินครอบครัว");
    expect(source).toContain('title="การเงิน"');
    expect(source).toContain('title="สัตว์เลี้ยง"');
    expect(source).toContain("<QuickLink");
  });

  it("composes source modules without writing duplicate records", () => {
    for (const sourceFunction of [
      "listCalendarEvents",
      "listPlanTasks",
      "listPlanReminders",
      "listCalendarFinanceItems",
      "getFinanceSummary",
      "listRecentFinanceTransactions",
      "listPets",
    ]) {
      expect(source).toContain(sourceFunction);
    }
    expect(source).not.toMatch(/\.from\(|\.insert\(|\.update\(/u);
  });

  it("uses real artwork for every time period without CSS image filters", () => {
    for (const asset of [
      "home-morning.webp",
      "home-afternoon.webp",
      "home-evening.webp",
      "home-late-night.webp",
      "home-birthday.webp",
    ]) {
      expect(source).toContain(asset);
    }
    expect(source).not.toMatch(/brightness-|saturate-|hue-rotate|sepia-/u);
  });

  it("keeps late-night cover copy readable over the dark artwork", () => {
    expect(source).toContain(
      'text: "text-white drop-shadow-[0_1px_3px_rgba(8,24,40,0.9)]"',
    );
    expect(source).toContain('coverMode === "late-night"');
    expect(source).toContain("from-[#081c30]/65");
  });
});
