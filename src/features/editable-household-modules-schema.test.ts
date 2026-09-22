import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260922233101_editable_household_modules.sql",
  ),
  "utf8",
);

describe("editable household module security", () => {
  it.each([
    "update_shopping_item",
    "update_inventory_item",
    "update_chore_template",
    "update_pet_care_record",
  ])("protects %s behind an authenticated RPC", (functionName) => {
    expect(migration).toContain(`create function public.${functionName}`);
    expect(migration).toContain("security definer");
    expect(migration).toMatch(
      new RegExp(
        `revoke execute on function public\\.${functionName}\\([\\s\\S]*?from public, anon;`,
      ),
    );
    expect(migration).toMatch(
      new RegExp(
        `grant execute on function public\\.${functionName}\\([\\s\\S]*?to authenticated;`,
      ),
    );
  });

  it("excludes observers from every editable module", () => {
    expect(migration.match(/array\['owner','admin','member'\]/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("array['owner','admin']::public.household_role[]");
    expect(migration).toContain("role <> 'observer'");
    expect(migration).toContain("array['member']::public.household_role[]");
  });

  it("preserves completed chore history and rebuilds only future work", () => {
    expect(migration).toContain(
      "where template_id = p_template_id and completed_at is null",
    );
    expect(migration).toContain("greatest(\n      v_template.starts_on");
  });

  it("records the pet-care editor without changing the original creator", () => {
    expect(migration).toContain("add column updated_by uuid");
    expect(migration).toContain("new.updated_by := auth.uid()");
    expect(migration).toContain("or new.created_by <> old.created_by");
  });
});
