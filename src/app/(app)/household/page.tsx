import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { HouseholdOverview } from "@/features/household/components/HouseholdOverview";
import { requireUser } from "@/lib/auth/require-user";

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

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">ครอบครัว</p>
        <h1 className="text-xl font-semibold">{household.name}</h1>
      </header>
      <HouseholdOverview members={members} userId={user.id} role={household.myRole} />
    </div>
  );
}
