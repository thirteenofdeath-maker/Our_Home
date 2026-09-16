import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260915181018_pet_care_records.sql"),
  "utf8",
);

describe("pet care records schema", () => {
  it("keeps the timeline attached to one household pet", () => {
    expect(sql).toContain("foreign key (pet_id, household_id)");
    expect(sql).toContain("references public.pets(id, household_id) on delete cascade");
  });

  it("supports the required care record types", () => {
    for (const type of ["HEALTH", "VACCINE", "MEDICATION", "VET", "WEIGHT", "EXPENSE", "DOCUMENT"]) {
      expect(sql).toContain(`'${type}'`);
    }
  });

  it("uses RLS and private document storage", () => {
    expect(sql).toContain("alter table public.pet_care_records enable row level security");
    expect(sql.match(/create policy pet_care_records_/g)).toHaveLength(4);
    expect(sql).toContain("'pet-documents'");
    expect(sql).toContain("false,");
    expect(sql.match(/create policy pet_documents_/g)).toHaveLength(4);
  });

  it("keeps Finance authoritative by storing only a transaction link", () => {
    expect(sql).toContain("transaction_id uuid references public.transactions(id) on delete set null");
    expect(sql).not.toContain("expense_amount");
  });
});
