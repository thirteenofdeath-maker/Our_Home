import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260922130047_rotating_household_chores.sql",
  ),
  "utf8",
);
const flexibleRecurrenceMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260930074858_flexible_chore_recurrence.sql",
  ),
  "utf8",
);
const form = readFileSync(
  resolve(process.cwd(), "src/features/chores/components/ChoreForm.tsx"),
  "utf8",
);
const page = readFileSync(
  resolve(process.cwd(), "src/app/(app)/calendar/page.tsx"),
  "utf8",
);

describe("rotating household chores contract", () => {
  it("keeps observers read-only while household participants can claim and complete", () => {
    expect(migration).toContain("role <> 'observer'");
    expect(migration).toContain("claim_chore_occurrence");
    expect(migration).toContain("complete_chore_occurrence");
    expect(page).toContain('household.myRole !== "observer"');
  });

  it("limits schedule management to owners and administrators", () => {
    expect(migration).toContain(
      "array['owner','admin']::public.household_role[]",
    );
    expect(page).toContain(
      'household.myRole === "owner" || household.myRole === "admin"',
    );
  });

  it("materializes deterministic rotations for every N days, weeks, months, or years", () => {
    expect(flexibleRecurrenceMigration).toContain(
      "cadence in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')",
    );
    expect(flexibleRecurrenceMigration).toContain(
      "v_date + v_template.interval_count",
    );
    expect(flexibleRecurrenceMigration).toContain(
      "public.recurring_next_due_date(",
    );
    expect(flexibleRecurrenceMigration).toContain(
      "v_existing_count % greatest",
    );
  });

  it("lets the form choose an interval and recurrence unit", () => {
    expect(form).toContain('name="intervalCount"');
    for (const cadence of ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]) {
      expect(form).toContain(`value="${cadence}"`);
    }
  });

  it("records original assignment, takeover and completion history", () => {
    expect(migration).toContain("original_assigned_member_id");
    expect(migration).toContain("taken_over_by");
    expect(migration).toContain("completed_by = auth.uid()");
  });
});
