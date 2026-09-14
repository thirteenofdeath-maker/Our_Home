import { describe, expect, it } from "vitest";

import type { TransactionHistoryItem } from "../types";
import { groupTransactionsByDate } from "./groupByDate";

function item(id: string, occurredAt: string): TransactionHistoryItem {
  return {
    transactionId: id,
    transactionType: "EXPENSE",
    title: id,
    note: null,
    occurredAt,
    categoryName: null,
    walletName: "MAKE",
    pocketName: "Cash",
    creatorName: null,
    amount: "-10.00",
    voidedAt: null,
  };
}

describe("groupTransactionsByDate", () => {
  const today = "2026-09-10";

  it('labels today\'s and yesterday\'s groups as "วันนี้"/"เมื่อวาน"', () => {
    const groups = groupTransactionsByDate(
      [item("a", "2026-09-10T11:00:00+07:00"), item("b", "2026-09-09T09:00:00+07:00")],
      today,
    );
    expect(groups.map((g) => g.label)).toEqual(["วันนี้", "เมื่อวาน"]);
  });

  it("formats an older date in Thai", () => {
    const groups = groupTransactionsByDate([item("a", "2026-09-01T08:00:00+07:00")], today);
    expect(groups[0]!.label).toMatch(/2569/); // Buddhist era year
  });

  it("preserves item order within each group and never drops or reorders items across groups", () => {
    const groups = groupTransactionsByDate(
      [item("a", "2026-09-10T20:00:00+07:00"), item("b", "2026-09-10T08:00:00+07:00"), item("c", "2026-09-09T08:00:00+07:00")],
      today,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]!.items.map((i) => i.transactionId)).toEqual(["a", "b"]);
    expect(groups[1]!.items.map((i) => i.transactionId)).toEqual(["c"]);
  });

  it("keys groups by the Bangkok calendar day, not a UTC-shifted one", () => {
    // 2026-09-09T18:00:00Z is already 2026-09-10 in Bangkok (+07:00).
    const groups = groupTransactionsByDate([item("a", "2026-09-09T18:00:00.000Z")], today);
    expect(groups[0]!.label).toBe("วันนี้");
  });
});
