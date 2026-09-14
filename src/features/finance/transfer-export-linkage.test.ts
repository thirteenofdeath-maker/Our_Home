import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0053_transfer_export_linkage.sql"), "utf8");
const route = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/export/download/route.ts"), "utf8");

describe("0053 transfer charge export linkage", () => {
  it("exports stable transfer linkage, kind, and scope without changing export authorization", () => {
    expect(sql).toContain("scope public.money_scope");
    expect(sql).toContain("linked_transfer_id uuid");
    expect(sql).toContain("transfer_charge_kind text");
    expect(sql).toContain("left join public.transfer_ledger_links as tll on tll.charge_transaction_id = t.id");
    expect(sql).toContain("tll.transfer_transaction_id");
    expect(sql).toContain("tll.kind");
    expect(sql).toContain("security invoker");
  });

  it("keeps principal machine-identifiable as TRANSFER and child charges as EXPENSE plus FEE/INTEREST", () => {
    expect(sql).toContain("transaction_type public.transaction_type");
    expect(sql).toContain("A principal row remains identifiable as transaction_type=TRANSFER");
    expect(sql).toContain("FEE and INTEREST child expenses");
  });

  it("includes the new stable fields in the downloaded CSV", () => {
    expect(route).toContain('"scope","linked_transfer_id","transfer_charge_kind"');
  });
});
