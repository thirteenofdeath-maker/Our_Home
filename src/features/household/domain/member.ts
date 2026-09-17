import type { HouseholdRole } from "@/types/database";

export const MEMBER_COLORS = [
  "#7A9E7E",
  "#7C9DBD",
  "#D49A89",
  "#C5A3C7",
  "#D2AD62",
  "#789F97",
] as const;
export type MemberColor = (typeof MEMBER_COLORS)[number];

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
