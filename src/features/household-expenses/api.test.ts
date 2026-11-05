import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database";
import { listHouseholdExpenses } from "./api";

function clientFor(result: unknown) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  return {
    client: { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>,
    query,
  };
}

describe("household expense migration readiness", () => {
  it.each(["PGRST205", "42P01"])(
    "returns an unavailable state for a missing expense table (%s)",
    async (code) => {
      const { client } = clientFor({
        data: null,
        error: {
          code,
          message: "Table public.household_expenses does not exist",
        },
      });
      expect(
        await listHouseholdExpenses(client, "household", "2026-11"),
      ).toBeNull();
    },
  );

  it("keeps a ready empty ledger distinct from a pending migration", async () => {
    const { client, query } = clientFor({ data: [], error: null });
    expect(await listHouseholdExpenses(client, "household", "2026-11")).toEqual(
      [],
    );
    expect(query.gte).toHaveBeenCalledWith("paid_on", "2026-11-01");
    expect(query.lt).toHaveBeenCalledWith("paid_on", "2026-12-01");
  });

  it("propagates access and network errors", async () => {
    const error = {
      code: "42501",
      message: "Permission denied for household_expenses",
    };
    const { client } = clientFor({ data: null, error });
    await expect(
      listHouseholdExpenses(client, "household", "2026-11"),
    ).rejects.toEqual(error);
  });
});
