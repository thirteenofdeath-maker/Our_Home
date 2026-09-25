import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("custom household member colors", () => {
  it("offers a native unrestricted color picker in both member forms", () => {
    const input = read(
      "src/features/household/components/MemberColorInput.tsx",
    );
    const profile = read("src/features/profile/components/ProfileEditForm.tsx");
    const presentation = read(
      "src/features/household/components/MemberPresentationForm.tsx",
    );

    expect(input).toContain('type="color"');
    expect(input).toContain('name="memberColor"');
    expect(profile).toContain("<MemberColorInput");
    expect(presentation).toContain("<MemberColorInput");
  });

  it("does not print the HEX value on household member cards", () => {
    const card = read("src/features/household/components/MemberCard.tsx");
    const roleLine = card.match(
      /<p className="text-sm text-finance-muted">([\s\S]*?)<\/p>/,
    )?.[1];
    expect(roleLine).toContain("ROLE_LABEL[member.role]");
    expect(roleLine).not.toContain("member.member_color");
  });

  it("migrates the fixed palette to safe six-digit HEX validation", () => {
    const migration = read(
      "supabase/migrations/20260925151533_allow_custom_member_colors.sql",
    );
    expect(migration).toContain(
      "drop constraint household_members_member_color_palette",
    );
    expect(migration).toContain("household_members_member_color_hex");
    expect(migration).toContain("^#[0-9A-Fa-f]{6}$");
    expect(migration).toContain("set member_color = upper(p_member_color)");
  });
});
