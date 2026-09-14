import { describe, expect, it } from "vitest";

import type { Pocket } from "@/features/pockets/types";

import { getPocketTransferDefaults } from "./PocketTransferForm";

function pocket(id: string, name: string): Pocket {
  return {
    id,
    wallet_id: "11111111-1111-4111-8111-111111111111",
    name,
    icon: null,
    sort_order: 0,
    is_archived: false,
    created_at: "2026-09-08T00:00:00Z",
    updated_at: "2026-09-08T00:00:00Z",
  };
}

describe("PocketTransferForm endpoint defaults (UI convenience only, no domain default pocket)", () => {
  it("returns no usable endpoints with fewer than two pockets", () => {
    expect(getPocketTransferDefaults([pocket("only", "Everyday")])).toBeNull();
  });

  it("pre-selects the first two pockets in list order — order is not a persisted default", () => {
    expect(getPocketTransferDefaults([pocket("food", "Food"), pocket("travel", "Travel")])).toEqual({
      fromPocketId: "food",
      toPocketId: "travel",
    });
  });

  it("works identically regardless of pocket naming — no pocket is treated as special", () => {
    expect(getPocketTransferDefaults([pocket("a", "Anything"), pocket("b", "Something Else"), pocket("c", "A Third One")])).toEqual({
      fromPocketId: "a",
      toPocketId: "b",
    });
  });
});
