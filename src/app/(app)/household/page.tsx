import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { AddMemberForm } from "@/features/household/components/AddMemberForm";
import { requireUser } from "@/lib/auth/require-user";

const ROLE_LABEL: Record<string, string> = { owner: "เจ้าของ", admin: "ผู้ดูแล", member: "สมาชิก" };

export default async function HouseholdPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);

  if (!household) {
    return (
      <EmptyState
        title="ยังไม่มีครอบครัว"
        description="สร้างครอบครัวเพื่อแชร์กระเป๋าเงินและหมวดหมู่ร่วมกัน"
        action={
          <Link href="/household/new" className={buttonClassName("primary", "md", "w-auto px-4")}>
            สร้างครอบครัว
          </Link>
        }
      />
    );
  }

  const members = await listHouseholdMembers(supabase, household.id);
  const canManage = household.myRole === "owner" || household.myRole === "admin";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{household.name}</h1>

      <Card>
        <h2 className="mb-2 text-sm font-medium text-foreground-muted">สมาชิก</h2>
        <ul className="flex flex-col divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span>{m.profile?.display_name ?? m.profile?.email}</span>
              <span className="text-foreground-muted">{ROLE_LABEL[m.role]}</span>
            </li>
          ))}
        </ul>
      </Card>

      {canManage ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium text-foreground-muted">เพิ่มสมาชิก</h2>
          <AddMemberForm householdId={household.id} />
        </Card>
      ) : null}
    </div>
  );
}
