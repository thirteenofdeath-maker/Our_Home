import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { canInviteRole } from "@/features/household/domain/member";
import { listRecentFinanceTransactions } from "@/features/finance/api";
import { archivePetAction } from "@/features/pets/actions";
import { getPet, getPetHouseholdRole, listPetCareRecords } from "@/features/pets/api";
import { PetCareRecordForm } from "@/features/pets/components/PetCareRecordForm";
import { PetCareTimeline } from "@/features/pets/components/PetCareTimeline";
import { PetPhoto } from "@/features/pets/components/PetPhoto";
import { SEX_LABEL, SPECIES_LABEL } from "@/features/pets/components/PetCard";
import { ageFromBirthday } from "@/features/pets/domain/pet";
import { requireUser } from "@/lib/auth/require-user";

export default async function PetDetailPage({ params }: PageProps<"/pets/[petId]">) {
  const { petId }=await params; const {supabase,user}=await requireUser();
  const pet=await getPet(supabase,petId); if(!pet) notFound();
  const [role, records, recentTransactions] = await Promise.all([
    getPetHouseholdRole(supabase,pet.household_id,user.id),
    listPetCareRecords(supabase, pet.id),
    listRecentFinanceTransactions(supabase, { limit: 30 }),
  ]);
  if(!role) notFound();
  const canManage=canInviteRole(role,"member"); const age=ageFromBirthday(pet.birthday);
  const latestWeight = records.find((record) => record.record_type === "WEIGHT");
  const expenseTransactions = recentTransactions.filter((transaction) => transaction.transactionType === "EXPENSE");
  return <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
    <PageHeader title={pet.name} backHref="/pets" />
    {!pet.archived_at ? <FormSheetButton
      ariaLabel="เพิ่มบันทึกการดูแล"
      triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      sheetTitle="เพิ่มบันทึกการดูแล"
      tone="finance"
      form={<PetCareRecordForm petId={pet.id} transactions={expenseTransactions} />}
    ><AppIcon name="plus" /></FormSheetButton> : null}
    <Card className="flex flex-col items-center gap-3 rounded-[1.5rem] bg-finance-surface-strong text-center"><PetPhoto name={pet.name} url={pet.photoUrl} size="lg"/><div><h1 className="text-xl font-semibold text-finance-text">{pet.name}</h1><p className="text-finance-muted">{SPECIES_LABEL[pet.species]}{pet.breed?` · ${pet.breed}`:""}</p></div>
      {latestWeight ? <div className="rounded-full bg-finance-primary-soft px-4 py-2 text-sm font-medium text-finance-primary-strong">น้ำหนักล่าสุด {latestWeight.value} {latestWeight.unit}</div> : null}
    </Card>
    <Card className="flex flex-col gap-2 rounded-[1.5rem] bg-finance-surface-strong text-finance-text"><p>เพศ: {pet.sex?SEX_LABEL[pet.sex]:"ไม่ระบุ"}</p><p>วันเกิด: {pet.birthday??"ไม่ระบุ"}{age!==null?` · อายุ ${age} ปี`:""}</p><p>สถานะ: {pet.archived_at?"เก็บเข้าคลัง":"ใช้งาน"}</p><div><p className="font-medium">ผู้ดูแล</p><p className="text-finance-muted">{pet.caregivers.length?pet.caregivers.map((item)=>item.profile?.display_name||item.profile?.email).join(", "):"ยังไม่ระบุ"}</p></div></Card>
    <section className="flex flex-col gap-3"><div><p className="text-sm text-finance-muted">สุขภาพและการดูแล</p><h2 className="font-semibold text-finance-text">ไทม์ไลน์ของ {pet.name}</h2></div><PetCareTimeline petId={pet.id} records={records}/></section>
    {canManage?<div className="flex flex-col gap-2"><Link href={`/pets/${pet.id}/edit`} className={buttonClassName("secondary","md")}>แก้ไข</Link><form action={archivePetAction}><input type="hidden" name="petId" value={pet.id}/><input type="hidden" name="archived" value={pet.archived_at?"false":"true"}/><button className={buttonClassName("primary","md")} type="submit">{pet.archived_at?"นำกลับมาใช้งาน":"เก็บเข้าคลัง"}</button></form></div>:null}
  </div>;
}
