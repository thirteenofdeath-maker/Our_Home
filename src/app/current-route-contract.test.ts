import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("current internal URL contract", () => {
  it("uses calendar views as the canonical household-care entry points", () => {
    const tabs = read("src/features/plan/components/PlanTabs.tsx");
    const home = read("src/app/(app)/page.tsx");

    for (const view of ["chores", "shopping", "inventory"]) {
      expect(tabs).toContain(`/calendar?view=${view}`);
      expect(home).toContain(`/calendar?view=${view}`);
    }
  });

  it("keeps old household-care entry points as compatibility redirects", () => {
    expect(read("src/app/(app)/chores/page.tsx")).toContain(
      'redirect("/calendar?view=chores")',
    );
    expect(read("src/app/(app)/shopping/page.tsx")).toContain(
      'redirect("/calendar?view=shopping")',
    );
    expect(read("src/app/(app)/inventory/page.tsx")).toContain(
      'redirect("/calendar?view=inventory")',
    );
  });

  it("uses calendar-nested URLs for household-care detail flows", () => {
    expect(
      read("src/features/inventory/components/InventoryItemCard.tsx"),
    ).toContain("/calendar/inventory/${item.id}");
    expect(
      read("src/features/shopping/components/ShoppingItemCard.tsx"),
    ).toContain("/calendar/shopping/${item.id}/expense");
    expect(
      read("supabase/functions/dispatch-notifications/index.ts"),
    ).toContain("/calendar/inventory/${row.id}");
  });

  it("keeps the plan cache and profile back navigation on current sections", () => {
    const preloader = read("src/components/shared/AppRoutePreloader.tsx");
    const worker = read("public/sw.js");
    const profile = read("src/app/(app)/profile/edit/page.tsx");

    expect(preloader).toContain('"/calendar?view=shopping"');
    expect(preloader).toContain('"/calendar?view=chores"');
    expect(preloader).toContain('"/calendar?view=inventory"');
    expect(worker).toContain('"/calendar"');
    expect(worker).not.toContain('"/shopping"');
    expect(worker).not.toContain('"/chores"');
    expect(worker).not.toContain('"/inventory"');
    expect(profile).toContain('backHref="/household"');
  });
});
