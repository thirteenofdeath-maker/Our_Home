import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { listHouseholdMembers } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { getPet, getPetHouseholdRole } from "@/features/pets/api";
import { PetForm } from "@/features/pets/components/PetForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditPetPage({params}:PageProps<"/pets/[petId]/edit">){const {petId}=await params;const{supabase,user}=await requireUser();const pet=await getPet(supabase,petId);if(!pet)notFound();const role=await getPetHouseholdRole(supabase,pet.household_id,user.id);if(!role||!canInviteRole(role,"member"))redirect(`/pets/${petId}`);const members=await listHouseholdMembers(supabase,pet.household_id);return <div className="flex flex-col gap-4"><h1 className="text-xl font-semibold">แก้ไข {pet.name}</h1><Card><PetForm members={members} pet={pet}/></Card></div>}
