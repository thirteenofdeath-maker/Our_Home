import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922130047_rotating_household_chores.sql"),
  "utf8",
);
const page = readFileSync(resolve(process.cwd(), "src/app/(app)/chores/page.tsx"), "utf8");

describe("rotating household chores contract", () => {
  it("keeps observers read-only while household participants can claim and complete", () => {
    expect(migration).toContain("role <> 'observer'");
    expect(migration).toContain("claim_chore_occurrence");
    expect(migration).toContain("complete_chore_occurrence");
    expect(page).toContain('household.myRole !== "observer"');
  });

  it("limits schedule management to owners and administrators", () => {
    expect(migration).toContain("array['owner','admin']::public.household_role[]");
    expect(page).toContain('household.myRole === "owner" || household.myRole === "admin"');
  });

  it("materializes deterministic daily or weekly rotations", () => {
    expect(migration).toContain("v_existing_count % greatest");
    expect(migration).toContain("when v_template.cadence = 'DAILY' then v_date + 1");
    expect(migration).toContain("else v_date + 7");
  });

  it("records original assignment, takeover and completion history", () => {
    expect(migration).toContain("original_assigned_member_id");
    expect(migration).toContain("taken_over_by");
    expect(migration).toContain("completed_by = auth.uid()");
  });
});
