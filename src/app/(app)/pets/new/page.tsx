import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { PetForm } from "@/features/pets/components/PetForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewPetPage() {
  const { supabase, user } = await requireUser(); const household=await getMyPrimaryHousehold(supabase,user.id);
  if (!household || !canInviteRole(household.myRole,"member")) redirect("/pets");
  const members=await listHouseholdMembers(supabase,household.id);
  return <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-4 px-4 pb-8 pt-3"><PageHeader title="เพิ่มสัตว์เลี้ยง" backHref="/pets" /><Card className="rounded-[1.25rem] bg-finance-surface-strong"><PetForm members={members}/></Card></div>;
}
