import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260915120703_plan_tasks_and_notes.sql",
  ),
  "utf8",
);

describe("Plan database security contract", () => {
  it("creates task, checklist, and note primitives", () => {
    expect(sql).toContain("create table public.plan_tasks");
    expect(sql).toContain("create table public.plan_task_steps");
    expect(sql).toContain("create table public.plan_notes");
  });

  it("enables RLS and grants only authenticated access", () => {
    for (const table of ["plan_tasks", "plan_task_steps", "plan_notes"]) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(sql).toContain("from anon, authenticated");
    expect(sql).toContain("to authenticated");
  });

  it("separates personal ownership and household membership", () => {
    expect(sql).toContain(
      "scope = 'PERSONAL' and created_by = (select auth.uid())",
    );
    expect(sql).toContain(
      "scope = 'HOUSEHOLD' and public.is_household_member(household_id)",
    );
  });

  it("protects identity fields from reassignment", () => {
    expect(sql).toContain("create function public.protect_plan_identity()");
    expect(sql).toContain("new.created_by <> old.created_by");
    expect(sql).toContain("new.household_id is distinct from old.household_id");
    expect(sql).toContain("new.task_id <> old.task_id");
  });

  it("keeps completion state internally consistent", () => {
    expect(
      sql.match(/is_completed and completed_at is not null/g),
    ).toHaveLength(2);
    expect(
      sql.match(/not is_completed and completed_at is null/g),
    ).toHaveLength(2);
  });
});
