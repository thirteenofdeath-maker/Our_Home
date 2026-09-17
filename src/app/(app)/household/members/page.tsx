import { redirect } from "next/navigation";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
import { AddMemberForm } from "@/features/household/components/AddMemberForm";
import { MemberRoleForm } from "@/features/household/components/MemberRoleForm";
import { MemberCard } from "@/features/household/components/MemberCard";
import { RemoveMemberButton } from "@/features/household/components/RemoveMemberButton";
import {
  canChangeMemberRole,
  canRemoveMember,
  countFamilyMembers,
} from "@/features/household/domain/member";
import { requireUser } from "@/lib/auth/require-user";
import { buttonClassName } from "@/components/ui/Button";

export default async function HouseholdMembersPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household) redirect("/household");
  const members = await listHouseholdMembers(supabase, household.id, {
    includeObservers: true,
  });
  const current = members.find((member) => member.user_id === user.id);

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PageHeader title="สมาชิกในบ้าน" backHref="/household" />
      <p className="-mt-3 text-center text-sm text-finance-muted">
        {household.name}
      </p>

      <p className="text-sm text-finance-muted">
        สมาชิก {countFamilyMembers(members)} คน · ผู้สังเกตการณ์{" "}
        {members.length - countFamilyMembers(members)} คน
      </p>
      {[
        {
          label: "สมาชิกในครอบครัว",
          items: members.filter((member) => member.role !== "observer"),
        },
        {
          label: "ผู้สังเกตการณ์",
          items: members.filter((member) => member.role === "observer"),
        },
      ].map((group) => (
        <section key={group.label} className="flex flex-col gap-2">
          <h2 className="font-semibold">{group.label}</h2>
          {group.items.length === 0 ? (
            <p className="text-sm text-finance-muted">ยังไม่มีผู้สังเกตการณ์</p>
          ) : null}
          {group.items.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isCurrent={member.user_id === user.id}
            >
              {canChangeMemberRole(household.myRole, member.role) ? (
                <MemberRoleForm
                  householdId={household.id}
                  memberId={member.id}
                  role={member.role as "admin" | "member" | "observer"}
                />
              ) : null}
              {canRemoveMember(household.myRole, member.role) &&
              member.user_id !== user.id ? (
                <RemoveMemberButton
                  householdId={household.id}
                  memberId={member.id}
                  name={
                    member.profile?.display_name ||
                    member.profile?.email ||
                    "สมาชิก"
                  }
                />
              ) : null}
            </MemberCard>
          ))}
        </section>
      ))}

      {current ? (
        <Card className="rounded-[1.25rem] bg-finance-surface-strong">
          <h2 className="mb-3 font-medium">โปรไฟล์ของคุณ</h2>
          <Link
            href="/profile/edit"
            className={buttonClassName("secondary", "md")}
          >
            แก้ไขโปรไฟล์
          </Link>
        </Card>
      ) : null}

      {household.myRole === "owner" || household.myRole === "admin" ? (
        <Card className="rounded-[1.25rem] bg-finance-surface-strong">
          <h2 className="mb-3 font-medium">เพิ่มสมาชิก</h2>
          <AddMemberForm
            householdId={household.id}
            canInviteAdmin={household.myRole === "owner"}
          />
        </Card>
      ) : null}
    </div>
  );
}
