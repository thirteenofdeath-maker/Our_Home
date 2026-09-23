import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("native-like main navigation performance", () => {
  it("deduplicates authentication work within a server render", () => {
    const auth = read("src/lib/auth/require-user.ts");
    expect(auth).toContain("cache(async function requireUser()");
  });

  it("runs finance materialization beside independent dashboard reads", () => {
    const finance = read("src/app/(app)/finance/page.tsx");
    const start = finance.indexOf("const materialization = materializeBills");
    const reads = finance.indexOf("await Promise.all([", start);
    const join = finance.indexOf("await materialization;", reads);

    expect(start).toBeGreaterThan(-1);
    expect(reads).toBeGreaterThan(start);
    expect(join).toBeGreaterThan(reads);
  });

  it("starts the home profile read before the onboarding gate", () => {
    const home = read("src/app/(app)/page.tsx");
    const profileStart = home.indexOf("const profilePromise =");
    const onboardingGate = home.indexOf('redirect("/onboarding")');
    const profileJoin = home.indexOf("profilePromise,", onboardingGate);

    expect(profileStart).toBeGreaterThan(-1);
    expect(onboardingGate).toBeGreaterThan(profileStart);
    expect(profileJoin).toBeGreaterThan(onboardingGate);
  });

  it("loads recent pet care in one household query instead of one query per pet", () => {
    const home = read("src/app/(app)/page.tsx");
    const index = read(
      "supabase/migrations/20260923004810_pet_care_recent_activity_index.sql",
    );
    expect(home).toContain("listRecentHouseholdPetCareRecords(");
    expect(home).not.toContain("pets.map(async (pet)");
    expect(index).toContain("on public.pet_care_records(household_id, created_at desc)");
    expect(index).toContain("where archived_at is null");
  });

  it("does not load wallets in the authenticated layout for unrelated pages", () => {
    const layout = read("src/app/(app)/layout.tsx");
    const quickAdd = read("src/components/shared/GlobalQuickAdd.tsx");
    expect(layout).not.toContain("listMyWallets");
    expect(layout).toContain("<GlobalQuickAdd />");
    expect(quickAdd).toContain("getGlobalQuickAddBootstrapData");
  });

  it("batches signed storage URLs", () => {
    const household = read("src/features/household/api.ts");
    const pets = read("src/features/pets/api.ts");
    expect(household).toContain("createSignedUrls(storedPaths");
    expect(pets.match(/createSignedUrls\(/g)).toHaveLength(2);
  });
});
