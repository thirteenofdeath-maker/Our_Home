import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Contextual create FAB — the real form slides up directly, never a redundant one-item choice sheet or a bare navigation link", () => {
  describe("Pets", () => {
    const list = read("src/app/(app)/pets/page.tsx");
    const detail = read("src/app/(app)/pets/[petId]/page.tsx");
    const fab = read("src/features/pets/components/AddPetFab.tsx");

    it("renders the real PetForm inside AddPetFab's sheet, not a link to /pets/new", () => {
      expect(fab).toContain("<PetForm");
      expect(fab).toContain('variant="sheet"');
      expect(list).not.toContain('"/pets/new"');
      expect(detail).not.toContain('"/pets/new"');
    });

    it("never bypasses the existing household/member permission gate", () => {
      // Same canManage = canInviteRole(...) check that already gated the
      // page's own creation action before this FAB existed — the FAB
      // reuses it, never renders unconditionally.
      expect(list).toMatch(/canManage\s*\?\s*<AddPetFab/);
      expect(detail).toMatch(/canManage\s*\?\s*<AddPetFab/);
      expect(list).toContain("canInviteRole(household.myRole");
      expect(detail).toContain("canInviteRole(role");
    });

    it("AddPetFab's own data loader re-enforces the same permission gate server-side — a client-only gate is not enough", () => {
      const loader = read("src/features/pets/quick-add-data.ts");
      expect(loader).toContain("canInviteRole(household.myRole");
    });
  });

  describe("Calendar", () => {
    const list = read("src/app/(app)/calendar/page.tsx");
    const detail = read("src/app/(app)/calendar/[eventId]/page.tsx");
    const createPage = read("src/app/(app)/calendar/new/page.tsx");
    const fab = read("src/features/calendar/components/AddCalendarEventFab.tsx");

    it("renders the real CalendarEventForm inside AddCalendarEventFab's sheet on both browse and detail contexts", () => {
      expect(fab).toContain("<CalendarEventForm");
      expect(fab).toContain('variant="sheet"');
      expect(list).toContain("<AddCalendarEventFab");
      expect(detail).toContain("<AddCalendarEventFab");
    });

    it("the full-page /calendar/new route still exists as a fallback/deep link, unmodified", () => {
      expect(createPage).toContain("<CalendarEventForm");
    });
  });

  describe("Household", () => {
    const root = read("src/app/(app)/household/page.tsx");
    const members = read("src/app/(app)/household/members/page.tsx");

    it("never invents a /household/members/new route anywhere in the app", () => {
      const appFiles = ["src/app/(app)/household/page.tsx", "src/app/(app)/household/members/page.tsx", "src/app/(app)/household/new/page.tsx"];
      for (const file of appFiles) {
        expect(read(file), file).not.toContain("/household/members/new");
      }
    });

    it("shows a FAB on an existing household that opens AddMemberForm directly in a sheet — never a navigation to /household/members just to add one member", () => {
      expect(root).toContain("<AddMemberForm");
      // `form` is a plain element prop, never a render-prop function —
      // household/page.tsx is a Server Component, so passing a callback
      // to the Client FormSheetButton would throw at runtime.
      expect(root).toMatch(/form=\{<AddMemberForm/);
      expect(root).not.toContain("renderForm={() =>");
    });

    it("gates the FAB with the exact same permission rule that already gates AddMemberForm on /household/members — reused, not a new authorization rule", () => {
      expect(root).toMatch(/canManageMembers\s*\?\s*\(?\s*<FormSheetButton/);
      expect(root).toContain("canInviteRole(household.myRole");
      // /household/members itself gates AddMemberForm the same way.
      expect(members).toMatch(/household\.myRole === "owner" \|\| household\.myRole === "admin"/);
    });

    it("the full manage/remove-members flow stays reachable on /household/members — this FAB only adds the single-creation-type shortcut, it doesn't replace management", () => {
      expect(members).toContain("<AddMemberForm");
      // HouseholdOverview (rendered on /household) still links there.
      const overview = read("src/features/household/components/HouseholdOverview.tsx");
      expect(overview).toContain('href="/household/members"');
    });

    it("does not duplicate the no-household EmptyState's own 'สร้างครอบครัว' CTA — that stays the only creation affordance when there is no household yet, and now opens CreateHouseholdForm directly instead of navigating", () => {
      expect(root).toContain("สร้างครอบครัว");
      expect(root).toContain("<AddHouseholdTrigger");
      const trigger = read("src/features/household/components/AddHouseholdTrigger.tsx");
      expect(trigger).toContain("<CreateHouseholdForm");
      expect(root).not.toContain('"/household/new"');
      // The member-add FAB block is only reachable once `household` is
      // truthy — it appears after the `if (!household)` early return.
      const noHouseholdReturnIdx = root.indexOf("if (!household)");
      const fabIdx = root.indexOf("<FormSheetButton");
      expect(noHouseholdReturnIdx).toBeGreaterThan(-1);
      expect(fabIdx).toBeGreaterThan(noHouseholdReturnIdx);
    });
  });

  describe("Finance", () => {
    it("with a wallet, renders the two-stage FinanceCreateFlow sheet (choice -> form-in-sheet, no full-page redirect for entry) rather than the old items-based ActionSheet", () => {
      const source = read("src/components/shared/GlobalQuickAdd.tsx");
      expect(source).toContain("<FinanceCreateFlow walletId={walletId} />");
      const flow = read("src/features/finance/components/FinanceCreateFlow.tsx");
      // Reuses the exact same writers/forms as the full-page routes —
      // never a fork. TransactionForm/PocketTransferForm/WalletTransferForm
      // are the SAME components transactions/actions.ts already wires up.
      expect(flow).toContain("<TransactionForm");
      expect(flow).toContain("<UnifiedTransferForm");
      expect(flow).not.toContain("transferChoice");
    });

    it("with no wallet, the real /wallets/new form (WalletForm) slides up directly — no fake route, no redundant one-item choice sheet", () => {
      const source = read("src/components/shared/GlobalQuickAdd.tsx");
      expect(source).toContain("<WalletForm");
      expect(source).not.toContain('"/wallets/new"'); // no literal href string anywhere — the real form itself renders, not a link to it
    });
  });
});
