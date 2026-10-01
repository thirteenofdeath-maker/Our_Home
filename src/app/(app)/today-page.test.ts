import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/(app)/page.tsx"),
  "utf8",
);
const householdSource = readFileSync(
  resolve(process.cwd(), "src/app/(app)/household/page.tsx"),
  "utf8",
);
const planSource = readFileSync(
  resolve(process.cwd(), "src/app/(app)/calendar/page.tsx"),
  "utf8",
);

describe("Today dashboard composition", () => {
  it("is a read-model dashboard rather than a redirect to wallets", () => {
    expect(source).not.toContain('redirect("/wallets")');
    expect(source).toContain("greetingForBangkok(now)");
    expect(source).toContain("homeCoverMode(profile?.birthday, now)");
    expect(source).toContain('title="งานวันนี้"');
    expect(source).toContain('title="งานค้าง"');
    expect(source).toContain('title="งานวันพรุ่งนี้"');
    expect(source).toContain("ปฏิทินครอบครัว");
    expect(source).toContain('title="กิจกรรมล่าสุด"');
    expect(source).not.toContain("วันนี้ต้องดู");
    expect(source).not.toContain("<QuickLink");
  });

  it("turns today and tomorrow into complete categorized timelines", () => {
    expect(source).toContain("const timelineForDate");
    expect(source).toContain("const todayTimeline = timelineForDate(today)");
    expect(source).toContain(
      "const tomorrowTimeline = timelineForDate(tomorrow)",
    );
    expect(source).toContain('category: "ปฏิทิน"');
    expect(source).toContain('category: "แผนงาน"');
    expect(source).toContain('category: "เตือนความจำ"');
    expect(source).toContain('category: "การเงิน"');
    expect(source).toContain('category: "สัตว์เลี้ยง"');
    expect(source).toContain('category: "งานบ้าน"');
    expect(source).toContain('role="progressbar"');
    expect(source).toContain(
      "เสร็จ ${completedCount} จาก ${trackableItems.length} งาน",
    );
  });

  it("shows one overdue dashboard for unfinished tasks, reminders, chores, and finance", () => {
    expect(source).toContain("const overdueTimeline");
    expect(source).toContain("task.due_date < today");
    expect(source).toContain("reminderDate < today");
    expect(source).toContain("chore.due_date < today");
    expect(source).toContain("item.date < today");
    expect(source).toContain("daysBetween");
    expect(source).toContain("showProgress={false}");
    expect(source).toContain('href: "/calendar?view=chores"');
    expect(source).toContain("href: item.href");
  });

  it("shows the assigned household member on every chore timeline", () => {
    expect(source).toContain("listHouseholdMembers");
    expect(source).toContain("householdMembersPromise");
    expect(source).toContain("const choreMemberNames");
    expect(source).toContain("choreAssigneeName(chore.assigned_member_id)");
    expect(source).toContain("ผู้รับผิดชอบ:");
    expect(source).toContain("line-clamp-2 text-xs text-finance-muted");
  });

  it("keeps household alerts and finance summary inside today's card", () => {
    expect(source).toContain("const todaySummary");
    expect(source).toContain("summaryItems={todaySummary}");
    expect(source).toContain('label: "คลังของ"');
    expect(source).toContain('label: "รายการซื้อของ"');
    expect(source).toContain("การเงินวันนี้");
    expect(source).toContain("openFinanceDue");
    expect(source).toContain("personalFinancePromise");
    expect(source).toContain("householdFinancePromise");
    expect(source).toContain("FinanceScopeSummary");
    expect(source).toContain('label="ส่วนตัว"');
    expect(source).toContain('label="ครอบครัว"');
    expect(source).toContain('href="/finance?scope=PERSONAL"');
    expect(source).toContain('href="/finance?scope=HOUSEHOLD"');
    expect(source).toContain("compactTodaySummary");
    expect(source).toContain('detail: "ซื้อครบแล้ว"');
    expect(source).toContain("grid-cols-1 gap-1.5 sm:grid-cols-2");
    expect(source).not.toContain("min-[380px]:grid-cols-2");
  });

  it("uses the scoped report read model so personal-funded household expenses appear once under household", () => {
    expect(source).toContain(
      'getFinanceReport(\n    supabase,\n    "PERSONAL"',
    );
    expect(source).toContain(
      'getFinanceReport(\n        supabase,\n        "HOUSEHOLD"',
    );
    expect(source).not.toContain("getFinanceSummary");
    expect(source).toContain('item.scope === "PERSONAL"');
    expect(source).toContain('item.scope === "HOUSEHOLD"');
  });

  it("streams the cover before daily and secondary dashboard data", () => {
    expect(source).toContain(
      "<Suspense fallback={<HomeTodaySkeleton />}> ".trim(),
    );
    expect(source).toContain(
      "<Suspense fallback={<HomeSecondarySkeleton />}> ".trim(),
    );
    expect(source).toContain("async function HomeTodaySections");
    expect(source).toContain("async function HomeSecondarySections");
    expect(source).toContain("eventsPromise={eventsPromise}");
    expect(source).toContain(
      "recentTransactionsPromise={recentTransactionsPromise}",
    );
  });

  it("composes source modules without writing duplicate records", () => {
    for (const sourceFunction of [
      "listCalendarEvents",
      "listPlanTasks",
      "listPlanReminders",
      "listCalendarFinanceItems",
      "getFinanceReport",
      "listRecentFinanceTransactions",
      "listRecentHouseholdPetCareRecords",
      "listChoreWorkspace",
      "listShoppingItems",
      "listInventoryItems",
    ]) {
      expect(source).toContain(sourceFunction);
    }
    expect(source).not.toMatch(/\.from\(|\.insert\(|\.update\(/u);
  });

  it("moves household operations to the plan dashboard", () => {
    for (const sourceFunction of [
      "listChoreWorkspace",
      "listShoppingItems",
      "listInventoryItems",
    ]) {
      expect(planSource).toContain(sourceFunction);
      expect(householdSource).not.toContain(sourceFunction);
    }
    expect(planSource).toContain("const activeCover = cover[view]");
    expect(planSource).toContain("<PlanTabs active={view} />");
    expect(planSource).not.toContain("<PlanModuleCard");
    expect(householdSource).not.toContain('aria-label="การจัดการบ้าน"');
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
