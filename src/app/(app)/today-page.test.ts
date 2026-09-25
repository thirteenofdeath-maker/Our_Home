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
      "listPetSummaries",
      "listRecentHouseholdPetCareRecords",
    ]) {
      expect(source).toContain(sourceFunction);
    }
    expect(source).not.toMatch(/\.from\(|\.insert\(|\.update\(/u);
  });

  it("uses real artwork for every time period without CSS image filters", () => {
    for (const asset of [
      "home-morning.webp",
      "home-late-morning.webp",
      "home-midday.webp",
      "home-afternoon.webp",
      "home-evening.webp",
      "home-night.webp",
      "home-late-night.webp",
      "home-birthday.webp",
    ]) {
      expect(source).toContain(asset);
    }
    expect(source).not.toMatch(/brightness-|saturate-|hue-rotate|sepia-/u);
  });

  it("uses the shared time-aware cover palette for every home artwork", () => {
    expect(source).toContain("light-cover-copy time-cover");
    expect(source).toContain("app-cover-image time-cover-image");
    expect(source).toContain("time-cover-overlay");
    expect(source).toContain("text-finance-text");
    expect(source).toContain("text-finance-muted");
    expect(source).not.toContain("from-[#081c30]/90");
    expect(source).not.toContain("rgba(255,249,239,0.97)");
  });
});
