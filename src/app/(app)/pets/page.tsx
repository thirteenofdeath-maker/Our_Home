import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { listPets } from "@/features/pets/api";
import { AddPetFab } from "@/features/pets/components/AddPetFab";
import { PetCard } from "@/features/pets/components/PetCard";
import { requireUser } from "@/lib/auth/require-user";

export default async function PetsPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household) return <Card>สร้างครอบครัวก่อนเพิ่มสัตว์เลี้ยง</Card>;
  const [active, archived] = await Promise.all([listPets(supabase, household.id), listPets(supabase, household.id, true)]);
  // Reuses the exact existing permission gate (canInviteRole) that the
  // page's own creation affordance already used — the FAB never bypasses
  // household/member permission rules, it just relocates the same check.
  const canManage = canInviteRole(household.myRole, "member");
  return <div className="flex flex-col gap-5"><header><p className="text-sm text-foreground-muted">{household.name}</p><h1 className="text-xl font-semibold">สัตว์เลี้ยง</h1></header>
    {canManage ? <AddPetFab /> : null}
    <section className="flex flex-col gap-3">{active.length ? active.map((pet)=><PetCard key={pet.id} pet={pet}/>) : <Card><p className="text-sm text-foreground-muted">ยังไม่มีสัตว์เลี้ยง</p></Card>}</section>
    {archived.length ? <section className="flex flex-col gap-3"><h2 className="font-semibold">เก็บเข้าคลัง</h2>{archived.map((pet)=><PetCard key={pet.id} pet={pet}/>)}</section> : null}
  </div>;
}
