import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { canInviteRole } from "@/features/household/domain/member";
import type { HouseholdMemberWithProfile } from "@/features/household/types";
import type { HouseholdRole } from "@/types/database";

import { MemberCard } from "./MemberCard";

export function partitionHouseholdMembers(members: HouseholdMemberWithProfile[], userId: string) {
  const current = members.find((member) => member.user_id === userId) ?? null;
  const others = members
    .filter((member) => member.user_id !== userId)
    .toSorted((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return { current, others };
}

export function HouseholdOverview({ members, userId, role }: {
  members: HouseholdMemberWithProfile[];
  userId: string;
  role: HouseholdRole;
}) {
  const { current, others } = partitionHouseholdMembers(members, userId);
  const canManage = canInviteRole(role, "member");

  return (
    <>
      {current ? (
        <section data-testid="current-user" aria-labelledby="your-profile-heading" className="flex flex-col gap-3">
          <h2 id="your-profile-heading" className="font-semibold">โปรไฟล์ของคุณ</h2>
          <MemberCard member={current} isCurrent />
          <Link href="/profile/edit" className={buttonClassName("secondary", "md")}>แก้ไขโปรไฟล์</Link>
        </section>
      ) : null}

      <section data-testid="other-members" aria-labelledby="other-members-heading" className="flex flex-col gap-3">
        <h2 id="other-members-heading" className="font-semibold">สมาชิกในครอบครัว</h2>
        {others.length > 0 ? (
          <div className="flex flex-col gap-2">
            {others.map((member) => <MemberCard key={member.id} member={member} />)}
          </div>
        ) : (
          <Card><p className="text-sm text-foreground-muted">ยังไม่มีสมาชิกคนอื่นในครอบครัว</p></Card>
        )}
      </section>

      <section aria-labelledby="member-management-heading">
        <Card className="flex flex-col gap-3">
          <div>
            <h2 id="member-management-heading" className="font-semibold">การจัดการสมาชิก</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {canManage ? "เชิญสมาชิกและจัดการสิทธิ์ของครอบครัว" : "ดูรายชื่อสมาชิกทั้งหมดในครอบครัว"}
            </p>
          </div>
          <Link href="/household/members" className={buttonClassName("primary", "md")}>
            {canManage ? "จัดการสมาชิก" : "ดูสมาชิกทั้งหมด"}
          </Link>
        </Card>
      </section>
    </>
  );
}
