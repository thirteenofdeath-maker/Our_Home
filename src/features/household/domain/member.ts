import type { HouseholdRole } from "@/types/database";

export const MEMBER_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function canChangeMemberRole(
  actorRole: HouseholdRole,
  targetRole: HouseholdRole,
): boolean {
  return actorRole === "owner" && targetRole !== "owner";
}

export function canInviteRole(
  actorRole: HouseholdRole,
  invitedRole: "admin" | "member" | "observer",
): boolean {
  return (
    actorRole === "owner" ||
    (actorRole === "admin" &&
      (invitedRole === "member" || invitedRole === "observer"))
  );
}

export function canRemoveMember(
  actorRole: HouseholdRole,
  targetRole: HouseholdRole,
): boolean {
  if (targetRole === "owner") return false;
  return (
    actorRole === "owner" ||
    (actorRole === "admin" &&
      (targetRole === "member" || targetRole === "observer"))
  );
}

export function countFamilyMembers(
  members: ReadonlyArray<{ role: HouseholdRole }>,
): number {
  return members.filter((member) => member.role !== "observer").length;
}
