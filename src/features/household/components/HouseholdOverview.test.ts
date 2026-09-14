import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { HouseholdMemberWithProfile } from "../types";
import { HouseholdOverview, partitionHouseholdMembers } from "./HouseholdOverview";

function member(id: string, userId: string, name: string, createdAt: string): HouseholdMemberWithProfile {
  return {
    id,
    household_id: "household-1",
    user_id: userId,
    role: userId === "current-user" ? "owner" : "member",
    member_color: "#7A9E7E",
    created_at: createdAt,
    profile: { display_name: name, email: `${name}@example.test`, avatar_url: null },
  };
}

const current = member("m-current", "current-user", "Current Person", "2026-01-01T00:00:00Z");
const otherA = member("m-a", "user-a", "Other Alpha", "2026-01-03T00:00:00Z");
const otherB = member("m-b", "user-b", "Other Beta", "2026-01-02T00:00:00Z");

function render(role: "owner" | "admin" | "member", members = [otherA, current, otherB]) {
  return renderToStaticMarkup(createElement(HouseholdOverview, { members, userId: "current-user", role }));
}

describe("HouseholdOverview", () => {
  it("renders the current user separately first without duplicating them", () => {
    const html = render("owner");
    expect(html.indexOf('data-testid="current-user"')).toBeLessThan(html.indexOf('data-testid="other-members"'));
    expect(html.match(/Current Person/g)).toHaveLength(1);
    expect(html).toContain("คุณ");
    expect(html).toContain('href="/profile/edit"');
  });

  it("renders other members in explicit stable order", () => {
    const { current: selected, others } = partitionHouseholdMembers([otherA, current, otherB], "current-user");
    expect(selected?.id).toBe("m-current");
    expect(others.map((item) => item.id)).toEqual(["m-b", "m-a"]);
    const html = render("owner");
    expect(html).toContain("Other Alpha");
    expect(html).toContain("Other Beta");
  });

  it.each([
    ["owner", "จัดการสมาชิก"],
    ["admin", "จัดการสมาชิก"],
    ["member", "ดูสมาชิกทั้งหมด"],
  ] as const)("uses permission-aware wording for %s", (role, label) => {
    const html = render(role);
    expect(html).toContain(`href="/household/members"`);
    expect(html).toContain(label);
  });

  it("shows a valid empty state for a single-person household", () => {
    const html = render("owner", [current]);
    expect(html).toContain("ยังไม่มีสมาชิกคนอื่นในครอบครัว");
    expect(html).toContain("จัดการสมาชิก");
  });
});
