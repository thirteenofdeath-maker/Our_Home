import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0024_profile_enhancement.sql"), "utf8");

describe("profile enhancement security contract", () => {
  it("keeps birthday private while granting only household display columns", () => {
    expect(sql).toMatch(/grant select \(id, display_name, email, avatar_url, gender, created_at, updated_at\)/);
    expect(sql).not.toMatch(/grant select \([^)]*birthday[^)]*\)/);
    expect(sql).toContain("create function public.get_own_profile()");
  });

  it("updates identity and household presentation at their proper boundaries", () => {
    expect(sql).toMatch(/update public\.household_members[\s\S]*where household_id = p_household_id and user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/update public\.profiles[\s\S]*where id = auth\.uid\(\)/);
  });

  it("constrains gender, birthday, and changed avatar paths", () => {
    expect(sql).toContain("'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'");
    expect(sql).toContain("birthday is null or birthday <= current_date");
    expect(sql).toContain("p_avatar_url is distinct from v_profile.avatar_url");
    expect(sql).toContain("auth.uid()::text || '/avatar\\.(jpg|png|webp)$'");
  });

  it("limits the private bucket and ownership policies", () => {
    expect(sql).toContain("values ('avatars', 'avatars', false, 5242880");
    expect(sql).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(sql.match(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
