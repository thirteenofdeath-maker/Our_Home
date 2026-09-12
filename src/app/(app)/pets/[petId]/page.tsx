import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { canInviteRole } from "@/features/household/domain/member";
import { archivePetAction } from "@/features/pets/actions";
import { getPet, getPetHouseholdRole } from "@/features/pets/api";
import { AddPetFab } from "@/features/pets/components/AddPetFab";
import { PetPhoto } from "@/features/pets/components/PetPhoto";
import { SEX_LABEL, SPECIES_LABEL } from "@/features/pets/components/PetCard";
import { ageFromBirthday } from "@/features/pets/domain/pet";
import { requireUser } from "@/lib/auth/require-user";

export default async function PetDetailPage({ params }: PageProps<"/pets/[petId]">) {
  const { petId }=await params; const {supabase,user}=await requireUser();
  const pet=await getPet(supabase,petId); if(!pet) notFound();
  const role=await getPetHouseholdRole(supabase,pet.household_id,user.id); if(!role) notFound();
  const canManage=canInviteRole(role,"member"); const age=ageFromBirthday(pet.birthday);
  return <div className="flex flex-col gap-4">
    {canManage ? <AddPetFab /> : null}
    <Card className="flex flex-col items-center gap-3 text-center"><PetPhoto name={pet.name} url={pet.photoUrl} size="lg"/><div><h1 className="text-xl font-semibold">{pet.name}</h1><p className="text-foreground-muted">{SPECIES_LABEL[pet.species]}{pet.breed?` · ${pet.breed}`:""}</p></div></Card>
    <Card className="flex flex-col gap-2"><p>เพศ: {pet.sex?SEX_LABEL[pet.sex]:"ไม่ระบุ"}</p><p>วันเกิด: {pet.birthday??"ไม่ระบุ"}{age!==null?` · อายุ ${age} ปี`:""}</p><p>สถานะ: {pet.archived_at?"เก็บเข้าคลัง":"ใช้งาน"}</p><div><p className="font-medium">ผู้ดูแล</p><p className="text-foreground-muted">{pet.caregivers.length?pet.caregivers.map((item)=>item.profile?.display_name||item.profile?.email).join(", "):"ยังไม่ระบุ"}</p></div></Card>
    {canManage?<div className="flex flex-col gap-2"><Link href={`/pets/${pet.id}/edit`} className={buttonClassName("secondary","md")}>แก้ไข</Link><form action={archivePetAction}><input type="hidden" name="petId" value={pet.id}/><input type="hidden" name="archived" value={pet.archived_at?"false":"true"}/><button className={buttonClassName("primary","md")} type="submit">{pet.archived_at?"นำกลับมาใช้งาน":"เก็บเข้าคลัง"}</button></form></div>:null}
  </div>;
}
