import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { AddHouseholdTrigger } from "@/features/household/components/AddHouseholdTrigger";
import { AddMemberForm } from "@/features/household/components/AddMemberForm";
import { HouseholdOverview } from "@/features/household/components/HouseholdOverview";
import { canInviteRole } from "@/features/household/domain/member";
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
          <AddHouseholdTrigger triggerClassName="flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
            สร้างครอบครัว
          </AddHouseholdTrigger>
        }
      />
    );
  }

  const members = await listHouseholdMembers(supabase, household.id);
  // Same permission rule that already gates the "เพิ่มสมาชิก" AddMemberForm
  // on /household/members (canInviteRole(role, "member") is true for
  // owner/admin) — reused here, not a new authorization rule. The full
  // manage/remove-members flow stays on /household/members (still linked
  // from HouseholdOverview below) — this FAB is only the single-creation-
  // type "add a member" shortcut, so its form slides up directly.
  const canManageMembers = canInviteRole(household.myRole, "member");

  return (
    <div className="flex flex-col gap-6">
      {canManageMembers ? (
        <FormSheetButton
          ariaLabel="เพิ่มสมาชิก"
          triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
          sheetTitle="เพิ่มสมาชิก"
          form={<AddMemberForm householdId={household.id} canInviteAdmin={household.myRole === "owner"} variant="sheet" />}
        >
          <AppIcon name="plus" />
        </FormSheetButton>
      ) : null}
      <header>
        <p className="text-sm text-foreground-muted">ครอบครัว</p>
        <h1 className="text-xl font-semibold">{household.name}</h1>
      </header>
      <HouseholdOverview members={members} userId={user.id} role={household.myRole} />
    </div>
  );
}
