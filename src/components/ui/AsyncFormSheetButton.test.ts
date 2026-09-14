import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const source = read("src/components/ui/AsyncFormSheetButton.tsx");

describe("AsyncFormSheetButton — the single-create-with-JIT-data-fetch primitive", () => {
  it("composes the same BottomSheet as FormSheetButton, never a second sheet/motion implementation", () => {
    expect(source).toContain('import { BottomSheet } from "@/components/ui/BottomSheet"');
    expect(source).toContain("<BottomSheet");
    expect(source).not.toMatch(/transition-\[|duration-\[\d+ms\]|\[transform:translate3d/);
  });

  it("fetches data only when the trigger is pressed (JIT), not on mount/every render", () => {
    expect(source).toMatch(/function handleOpen\(\)\s*\{[\s\S]*?loadData\(\)/);
  });

  it("discards fetched data on close, so the next open re-fetches fresh rather than showing stale wallets/categories", () => {
    expect(source).toMatch(/function handleClose\(\)\s*\{[\s\S]*?setData\(null\)/);
  });

  it("surfaces a real error without crashing when the JIT fetch fails, and never silently swallows it", () => {
    expect(source).toMatch(/catch\s*\{\s*setError\(/);
    expect(source).toContain("{error ?");
  });

  it("passes tone through to BottomSheet, defaulting to \"default\" — Pet/Calendar/Household never opt into Finance V2 tone", () => {
    expect(source).toContain('tone = "default"');
    expect(source).toContain("tone={tone}");
  });
});

describe("Every JIT-data create sheet mirrors its full-page route's exact selectors — no new/duplicated query", () => {
  const cases: Array<{ loader: string; selectors: string[] }> = [
    { loader: "src/features/budgets/quick-add-data.ts", selectors: ["listCategories(supabase", "getMyPrimaryHousehold(supabase"] },
    { loader: "src/features/goals/quick-add-data.ts", selectors: ["listMyWallets(supabase)", "listPocketsForWallet(supabase"] },
    { loader: "src/features/installments/quick-add-data.ts", selectors: ["listCategories(supabase"] },
    { loader: "src/features/debts/quick-add-data.ts", selectors: ["listMyWallets(supabase)", "listPocketsForWallet(supabase"] },
    { loader: "src/features/bills/quick-add-data.ts", selectors: ["listMyWallets(supabase)", "listCategories(supabase", "listTags(supabase"] },
    { loader: "src/features/recurring/quick-add-data.ts", selectors: ["listMyWallets(supabase)", "listCategories(supabase", "listTags(supabase"] },
    { loader: "src/features/templates/quick-add-data.ts", selectors: ["listMyWallets(supabase)", "listCategories(supabase", "listTags(supabase"] },
    { loader: "src/features/pets/quick-add-data.ts", selectors: ["listHouseholdMembers(supabase", "canInviteRole"] },
    { loader: "src/features/calendar/quick-add-data.ts", selectors: ["listHouseholdMembers(supabase"] },
  ];

  for (const { loader, selectors } of cases) {
    it(`${loader} uses only existing selectors, never a raw .rpc()/.from() call`, () => {
      const src = read(loader);
      expect(src).toContain('"use server"');
      for (const selector of selectors) expect(src, `${loader} should call ${selector}`).toContain(selector);
      expect(src).not.toMatch(/\.rpc\(|\.from\(["'][a-z_]+["']\)/);
    });
  }
});
