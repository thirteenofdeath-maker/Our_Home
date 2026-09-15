import { redirect } from "next/navigation";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { AddMemberForm } from "@/features/household/components/AddMemberForm";
import { MemberRoleForm } from "@/features/household/components/MemberRoleForm";
import { MemberCard } from "@/features/household/components/MemberCard";
import { canChangeMemberRole } from "@/features/household/domain/member";
import { requireUser } from "@/lib/auth/require-user";
import { buttonClassName } from "@/components/ui/Button";

export default async function HouseholdMembersPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household) redirect("/household");
  const members = await listHouseholdMembers(supabase, household.id);
  const current = members.find((member) => member.user_id === user.id);

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PageHeader title="สมาชิกในบ้าน" backHref="/household" />
      <p className="-mt-3 text-center text-sm text-finance-muted">{household.name}</p>

      <div className="flex flex-col gap-2">
        {members.map((member) => (
            <MemberCard key={member.id} member={member} isCurrent={member.user_id === user.id}>
              {canChangeMemberRole(household.myRole, member.role) ? (
                <MemberRoleForm householdId={household.id} memberId={member.id} role={member.role as "admin" | "member"} />
              ) : null}
            </MemberCard>
        ))}
      </div>

      {current ? (
        <Card className="rounded-[1.25rem] bg-finance-surface-strong">
          <h2 className="mb-3 font-medium">โปรไฟล์ของคุณ</h2>
          <Link href="/profile/edit" className={buttonClassName("secondary", "md")}>แก้ไขโปรไฟล์</Link>
        </Card>
      ) : null}

      {household.myRole === "owner" || household.myRole === "admin" ? (
        <Card className="rounded-[1.25rem] bg-finance-surface-strong">
          <h2 className="mb-3 font-medium">เพิ่มสมาชิก</h2>
          <AddMemberForm householdId={household.id} canInviteAdmin={household.myRole === "owner"} />
        </Card>
      ) : null}
    </div>
  );
}
