import { describe, expect, it } from "vitest";

import {
  canChangeMemberRole,
  canInviteRole,
  canRemoveMember,
  countFamilyMembers,
  MEMBER_COLOR_PATTERN,
} from "./member";

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

  it("accepts any six-digit hex member color", () => {
    expect(MEMBER_COLOR_PATTERN.test("#7A9E7E")).toBe(true);
    expect(MEMBER_COLOR_PATTERN.test("#123abc")).toBe(true);
    expect(MEMBER_COLOR_PATTERN.test("red")).toBe(false);
    expect(MEMBER_COLOR_PATTERN.test("#1234")).toBe(false);
  });
});

describe("observer and removal permissions", () => {
  const roles = ["owner", "admin", "member", "observer"] as const;
  for (const actor of roles) {
    for (const target of roles) {
      it(actor + " removal of " + target, () => {
        const allowed =
          (actor === "owner" && target !== "owner") ||
          (actor === "admin" && (target === "member" || target === "observer"));
        expect(canRemoveMember(actor, target)).toBe(allowed);
      });
    }
  }
  it("excludes observers from the family total", () => {
    expect(countFamilyMembers(roles.map((role) => ({ role })))).toBe(3);
    expect(countFamilyMembers([{ role: "observer" }])).toBe(0);
  });
  it("allows owners/admins to invite observers, but observers cannot manage access", () => {
    expect(canInviteRole("owner", "observer")).toBe(true);
    expect(canInviteRole("admin", "observer")).toBe(true);
    expect(canInviteRole("observer", "member")).toBe(false);
    expect(canChangeMemberRole("observer", "member")).toBe(false);
  });
});
