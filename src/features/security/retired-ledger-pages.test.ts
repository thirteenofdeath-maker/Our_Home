import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  client: {} as unknown,
  reads: [] as string[],
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: async () => ({
    supabase: state.client,
    user: { id: "11111111-1111-4111-8111-111111111111" },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import HouseholdPage from "@/app/(app)/household/page";
import PetDetailPage from "@/app/(app)/pets/[petId]/page";
import {
  countCompletedChores,
  listChoreWorkspace,
} from "@/features/chores/api";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
const house = "22222222-2222-4222-8222-222222222222";
const pet = "33333333-3333-4333-8333-333333333333";
function client() {
  const retired = new Set([
    "transactions",
    "transaction_entries",
    "wallets",
    "pockets",
    "categories",
    "expense_adjustments",
  ]);
  return {
    from(table: string) {
      state.reads.push(table);
      if (retired.has(table))
        throw new Error(`42501: permission denied for table ${table}`);
      let selection = "";
      let head = false;
      let limit = 1000;
      let noRows = false;
      const rows = () => {
        if (noRows) return [];
        if (table === "household_members")
          return [
            {
              id: "member",
              user_id: "11111111-1111-4111-8111-111111111111",
              household_id: house,
              role: "owner",
              profile: { display_name: "Member", avatar_url: null },
            },
          ];
        if (table === "household_expenses")
          return [
            {
              id: "expense",
              household_id: house,
              title: "Pet supplies",
              paid_on: "2026-11-05",
              created_by: "11111111-1111-4111-8111-111111111111",
              amount: 100,
              category: "pets",
            },
          ];
        if (table === "pets")
          return [
            {
              id: pet,
              household_id: house,
              name: "Mochi",
              species: "CAT",
              photo_path: null,
              birthday: null,
              archived_at: null,
            },
          ];
        if (table === "chore_occurrences")
          return Array.from({ length: Math.min(limit, 120) }, (_, i) => ({
            id: String(i),
            due_date: "2026-11-04",
            completed_at: "2026-11-05T00:00:00Z",
            completion_kind: "DONE",
          }));
        return [];
      };
      const q = {
        select(value: string, options?: { head?: boolean }) {
          selection = value;
          head = Boolean(options?.head);
          return q;
        },
        eq() {
          return q;
        },
        is(column: string, value: unknown) {
          if (column === "completed_at" && value === null) noRows = true;
          return q;
        },
        not() {
          return q;
        },
        gte() {
          if (table === "chore_occurrences") noRows = true;
          return q;
        },
        lt() {
          return q;
        },
        order(column: string) {
          if (
            table === "household_expenses" &&
            !["paid_on", "id"].includes(column)
          )
            throw new Error(`unknown expense column ${column}`);
          return q;
        },
        limit(value: number) {
          limit = value;
          return q;
        },
        range() {
          return q;
        },
        in() {
          return q;
        },
        async maybeSingle() {
          return {
            data: selection.includes("household:households")
              ? { role: "owner", household: { id: house, name: "Home" } }
              : table === "household_members"
                ? { role: "owner" }
                : rows()[0],
            error: null,
          };
        },
        then(resolve: (result: unknown) => unknown) {
          return Promise.resolve({
            data: head ? null : rows(),
            count: head ? 120 : null,
            error: null,
          }).then(resolve);
        },
      };
      return q;
    },
  } as unknown as SupabaseClient<Database>;
}
describe("active pages with retired ledger privileges revoked", () => {
  beforeEach(() => {
    state.reads = [];
    state.client = client();
  });
  it("loads the complete household page using household expenses", async () => {
    expect(await HouseholdPage()).toBeTruthy();
    expect(state.reads).toContain("household_expenses");
    expect(state.reads).not.toContain("transactions");
  });
  it("loads the complete pet profile and care timeline without finance reads", async () => {
    expect(
      await PetDetailPage({
        params: Promise.resolve({ petId: pet }),
      } as Parameters<typeof PetDetailPage>[0]),
    ).toBeTruthy();
    expect(state.reads).toContain("pet_care_records");
    expect(state.reads).not.toContain("transactions");
  });
  it("counts all completed chores independently of the twelve-row history", async () => {
    const db = state.client as SupabaseClient<Database>;
    expect(await countCompletedChores(db, house)).toBe(120);
    const workspace = await listChoreWorkspace(db, house);
    expect(workspace.occurrences).toHaveLength(12);
  });
});
