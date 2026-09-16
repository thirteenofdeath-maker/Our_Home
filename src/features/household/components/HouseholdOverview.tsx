import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { canInviteRole } from "@/features/household/domain/member";
import type { HouseholdMemberWithProfile } from "@/features/household/types";
import { Avatar } from "@/features/profile/components/Avatar";
import type { HouseholdRole } from "@/types/database";

import { ROLE_LABEL } from "./MemberCard";

export function partitionHouseholdMembers(
  members: HouseholdMemberWithProfile[],
  userId: string,
) {
  const current = members.find((member) => member.user_id === userId) ?? null;
  const others = members
    .filter((member) => member.user_id !== userId)
    .toSorted(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  return { current, others };
}

export function HouseholdOverview({
  members,
  userId,
  role,
}: {
  members: HouseholdMemberWithProfile[];
  userId: string;
  role: HouseholdRole;
}) {
  const { current, others } = partitionHouseholdMembers(members, userId);
  const canManage = canInviteRole(role, "member");

  return (
    <>
      <section
        aria-labelledby="household-members-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="household-members-heading"
            className="font-semibold text-finance-text"
          >
            สมาชิกในบ้าน
          </h2>
          <Link
            href="/household/members"
            className="flex min-h-11 items-center rounded-full bg-[#f8dfd0] px-4 text-sm font-medium text-finance-text"
          >
            {canManage ? "จัดการสมาชิก" : "ดูสมาชิกทั้งหมด"}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {current ? (
            <div data-testid="current-user" className="contents">
              <Link
                href="/profile/edit"
                className="focus-visible:outline-2 focus-visible:outline-finance-primary"
              >
                <FamilyMemberTile member={current} isCurrent />
              </Link>
            </div>
          ) : null}
          <div data-testid="other-members" className="contents">
            {others.map((member) => (
              <FamilyMemberTile key={member.id} member={member} />
            ))}
          </div>
        </div>
        {others.length === 0 ? (
          <Card className="rounded-[1.25rem] bg-finance-surface-strong">
            <p className="text-sm text-finance-muted">
              ยังไม่มีสมาชิกคนอื่นในครอบครัว
            </p>
          </Card>
        ) : null}
        <p className="text-xs text-finance-muted">
          {canManage
            ? "เชิญสมาชิกด้วยอีเมลและจัดการบทบาทของครอบครัว"
            : "ดูรายชื่อสมาชิกและบทบาทในครอบครัว"}
        </p>
      </section>
    </>
  );
}

function FamilyMemberTile({
  member,
  isCurrent = false,
}: {
  member: HouseholdMemberWithProfile;
  isCurrent?: boolean;
}) {
  const name =
    member.profile?.display_name || member.profile?.email || "Member";
  return (
    <Card className="flex min-h-44 flex-col items-center justify-center rounded-[1.4rem] bg-finance-surface-strong p-3 text-center">
      <Avatar
        displayName={name}
        url={member.profile?.avatar_url ?? null}
        color={member.member_color}
        size="lg"
      />
      <p className="mt-3 max-w-full truncate font-semibold text-finance-text">
        {name}{" "}
        {isCurrent ? (
          <span className="text-xs text-finance-primary-strong">คุณ</span>
        ) : null}
      </p>
      <span className="mt-1 rounded-full bg-finance-primary-soft px-3 py-1 text-xs text-finance-primary-strong">
        {ROLE_LABEL[member.role]}
      </span>
    </Card>
  );
}
