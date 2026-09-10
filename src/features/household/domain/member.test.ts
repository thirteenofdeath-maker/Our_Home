import { describe, expect, it } from "vitest";

import { canChangeMemberRole, canInviteRole, MEMBER_COLORS } from "./member";

describe("member permissions", () => {
  it("lets only owner change eligible admin/member roles", () => {
    expect(canChangeMemberRole("owner", "member")).toBe(true);
    expect(canChangeMemberRole("owner", "admin")).toBe(true);
    expect(canChangeMemberRole("owner", "owner")).toBe(false);
    expect(canChangeMemberRole("admin", "member")).toBe(false);
    expect(canChangeMemberRole("member", "member")).toBe(false);
  });

  it("matches existing invite policy", () => {
    expect(canInviteRole("owner", "admin")).toBe(true);
    expect(canInviteRole("admin", "member")).toBe(true);
    expect(canInviteRole("admin", "admin")).toBe(false);
    expect(canInviteRole("member", "member")).toBe(false);
  });

  it("uses only constrained member colors", () => {
    expect(MEMBER_COLORS).toContain("#7A9E7E");
    expect(MEMBER_COLORS).not.toContain("red");
  });
});
