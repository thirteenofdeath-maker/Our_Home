import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260915175335_plan_reminders.sql",
  ),
  "utf8",
);

describe("Plan reminder database contract", () => {
  it("keeps reminders as a first-class source table", () => {
    expect(sql).toContain("create table public.plan_reminders");
    expect(sql).toContain("reminds_at timestamptz not null");
    expect(sql).toContain(
      "recurrence in ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')",
    );
  });

  it("enforces household visibility and immutable ownership", () => {
    expect(sql).toContain(
      "alter table public.plan_reminders enable row level security",
    );
    expect(sql).toContain("created_by = (select auth.uid())");
    expect(sql).toContain("public.is_household_member(household_id)");
    expect(sql).toContain("new.household_id is distinct from old.household_id");
  });

  it("requires both using and with check for updates", () => {
    const updatePolicy = sql.slice(
      sql.indexOf("create policy plan_reminders_update_allowed"),
      sql.indexOf("create policy plan_reminders_delete_allowed"),
    );
    expect(updatePolicy).toContain("using (");
    expect(updatePolicy).toContain("with check (");
  });
});
