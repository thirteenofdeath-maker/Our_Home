import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ageFromBirthday } from "../domain/pet";
import type { PetWithCaregivers } from "../types";
import { PetPhoto } from "./PetPhoto";

export const SPECIES_LABEL = { CAT:"แมว", DOG:"สุนัข", RABBIT:"กระต่าย", BIRD:"นก", FISH:"ปลา", OTHER:"อื่น ๆ" } as const;
export const SEX_LABEL = { MALE:"ผู้", FEMALE:"เมีย", UNKNOWN:"ไม่ทราบ" } as const;

export function PetCard({ pet }: { pet: PetWithCaregivers }) {
  const age = ageFromBirthday(pet.birthday);
  return <Link href={`/pets/${pet.id}`} className="block focus-visible:outline-2 focus-visible:outline-primary">
    <Card className="flex gap-3">
      <PetPhoto name={pet.name} url={pet.photoUrl} />
      <div className="min-w-0"><h2 className="font-semibold">{pet.name}</h2><p className="text-sm text-foreground-muted">{SPECIES_LABEL[pet.species]}{pet.breed ? ` · ${pet.breed}` : ""}{pet.sex ? ` · ${SEX_LABEL[pet.sex]}` : ""}</p>
      {age !== null ? <p className="text-sm text-foreground-muted">อายุ {age} ปี</p> : null}
      <p className="truncate text-sm text-foreground-muted">ผู้ดูแล: {pet.caregivers.length ? pet.caregivers.map((item) => item.profile?.display_name || item.profile?.email).join(", ") : "ยังไม่ระบุ"}</p></div>
    </Card>
  </Link>;
}
