import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { PetForm } from "@/features/pets/components/PetForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewPetPage() {
  const { supabase, user } = await requireUser(); const household=await getMyPrimaryHousehold(supabase,user.id);
  if (!household || !canInviteRole(household.myRole,"member")) redirect("/pets");
  const members=await listHouseholdMembers(supabase,household.id);
  return <div className="flex flex-col gap-4"><h1 className="text-xl font-semibold">เพิ่มสัตว์เลี้ยง</h1><Card><PetForm members={members}/></Card></div>;
}
