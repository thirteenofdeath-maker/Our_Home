import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = path.resolve(import.meta.dirname, "../../../supabase/migrations");

describe("household creation schema compatibility", () => {
  it("creates owner membership through one database trigger", () => {
    const sql = readFileSync(path.join(migrations, "0004_household_members.sql"), "utf8");
    expect(sql.match(/create trigger households_after_insert_add_owner/g)).toHaveLength(1);
    expect(sql).toContain("insert into public.household_members (household_id, user_id, role)");
    expect(sql).toContain("values (new.id, new.created_by, 'owner')");
  });

  it("gives member_color a valid default without requiring trigger changes", () => {
    const sql = readFileSync(path.join(migrations, "0023_member_management_foundation.sql"), "utf8");
    expect(sql).toContain("add column member_color text not null default '#7A9E7E'");
    expect(sql).toMatch(/member_color in \([^)]*'#7A9E7E'/s);
  });

  it("keeps direct membership writes revoked", () => {
    const sql = readFileSync(path.join(migrations, "0016_household_invite_and_owner_integrity.sql"), "utf8");
    expect(sql).toContain("revoke insert, update, delete on public.household_members from authenticated");
  });
});
