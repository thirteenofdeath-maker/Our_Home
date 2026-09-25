import Link from "next/link";
import Image from "next/image";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { listPetCareRecords, listPets } from "@/features/pets/api";
import { AddPetFab } from "@/features/pets/components/AddPetFab";
import {
  PetCard,
  SEX_LABEL,
  SPECIES_LABEL,
} from "@/features/pets/components/PetCard";
import { PetPhoto } from "@/features/pets/components/PetPhoto";
import { petCareDateLabel } from "@/features/pets/domain/care-record";
import { ageFromBirthday } from "@/features/pets/domain/pet";
import { requireUser } from "@/lib/auth/require-user";

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{ pet?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { pet: selectedPetId } = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household) return <Card>สร้างครอบครัวก่อนเพิ่มสัตว์เลี้ยง</Card>;

  const [active, archived] = await Promise.all([
    listPets(supabase, household.id),
    listPets(supabase, household.id, true),
  ]);
  const recordsByPet = new Map(
    await Promise.all(
      active.map(
        async (pet) =>
          [pet.id, await listPetCareRecords(supabase, pet.id)] as const,
      ),
    ),
  );
  const canManage = canInviteRole(household.myRole, "member");
  const featured =
    active.find((pet) => pet.id === selectedPetId) ?? active[0] ?? null;
  const records = featured ? (recordsByPet.get(featured.id) ?? []) : [];
  const age = featured ? ageFromBirthday(featured.birthday) : null;
  const latestWeight = records.find(
    (record) => record.record_type === "WEIGHT",
  );
  const latestHealth = records.find(
    (record) => record.record_type === "HEALTH",
  );
  const latestVaccine = records.find(
    (record) => record.record_type === "VACCINE",
  );
  const nextCare = records
    .filter(
      (record) =>
        record.scheduled_at && new Date(record.scheduled_at) >= new Date(),
    )
    .toSorted((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))[0];

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      {canManage ? <AddPetFab /> : null}

      <section className="app-cover app-cover-pets light-cover-copy time-cover relative h-48 overflow-hidden rounded-[1.75rem] p-5 shadow-card sm:h-52 sm:p-6">
        <Image
          src="/art/pets-garden.webp"
          alt="เหล่าสัตว์เลี้ยงพักผ่อนในสวนของบ้าน"
          fill
          priority
          sizes="(orientation: landscape) and (min-width: 700px) calc(100vw - 7rem), (max-width: 640px) 100vw, 576px"
          className="app-cover-image time-cover-image object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="time-cover-overlay absolute inset-0"
        />
        <header className="relative max-w-[58%]">
          <p className="text-xs font-medium text-finance-primary-strong">
            สมาชิกตัวน้อยของบ้าน
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-finance-text">
            สัตว์เลี้ยงของเรา
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-finance-muted">
            ดูแลสุขภาพและตารางสำคัญในที่เดียว
          </p>
        </header>
      </section>

      <div className="landscape-pets-split landscape-scroll-columns flex min-w-0 flex-col gap-5">
        <div className="landscape-pets-column landscape-scroll-column flex min-w-0 flex-col gap-3">
          {active.length ? (
            <section
              className="flex flex-col gap-3"
              aria-labelledby="pet-selector-title"
            >
              <h2
                id="pet-selector-title"
                className="font-semibold text-finance-text"
              >
                เลือกสัตว์เลี้ยง
              </h2>
              <div className="flex gap-3 overflow-x-auto rounded-[1.5rem] bg-finance-surface-strong p-3 shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {active.map((pet) => {
                  const isSelected = pet.id === featured?.id;
                  return (
                    <Link
                      key={pet.id}
                      href={`/pets?pet=${pet.id}`}
                      aria-current={isSelected ? "true" : undefined}
                      className={`flex w-24 shrink-0 flex-col items-center gap-2 rounded-[1.15rem] border p-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-finance-primary ${
                        isSelected
                          ? "border-finance-primary/30 bg-finance-primary-soft/55"
                          : "border-transparent bg-transparent"
                      }`}
                    >
                      <PetPhoto name={pet.name} url={pet.photoUrl} size="md" />
                      <span className="min-w-0 max-w-full">
                        <span className="block truncate font-semibold text-finance-text">
                          {pet.name}
                        </span>
                        <span className="block truncate text-xs text-finance-muted">
                          {SPECIES_LABEL[pet.species]}
                          {pet.breed ? ` · ${pet.breed}` : ""}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="landscape-pets-column landscape-scroll-column flex min-w-0 flex-col gap-3">
          {featured ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-finance-muted">ข้อมูลของ</p>
                  <h2 className="truncate font-semibold text-finance-text">
                    {featured.name}
                  </h2>
                </div>
                <Link
                  href={`/pets/${featured.id}`}
                  className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-finance-primary-soft px-4 text-sm font-medium text-finance-primary-strong"
                >
                  ดูโปรไฟล์
                  <AppIcon name="chevron" className="size-4" />
                </Link>
              </div>

              <section
                className="grid grid-cols-2 gap-2.5"
                aria-label={`สรุปการดูแล ${featured.name}`}
              >
                <PetSummaryCard
                  icon="info"
                  title="สุขภาพโดยรวม"
                  value={latestHealth?.title ?? "ยังไม่มีบันทึก"}
                  detail={
                    latestHealth
                      ? petCareDateLabel(latestHealth.recorded_at)
                      : "เพิ่มบันทึกสุขภาพ"
                  }
                  tone="green"
                />
                <PetSummaryCard
                  icon="plus"
                  title="วัคซีน"
                  value={latestVaccine?.title ?? "ยังไม่มีข้อมูล"}
                  detail={
                    latestVaccine
                      ? petCareDateLabel(latestVaccine.recorded_at)
                      : "เพิ่มประวัติวัคซีน"
                  }
                  tone="blue"
                />
                <PetSummaryCard
                  icon="calendar"
                  title="นัดถัดไป"
                  value={nextCare?.title ?? "ยังไม่มีนัด"}
                  detail={
                    nextCare?.scheduled_at
                      ? petCareDateLabel(nextCare.scheduled_at)
                      : "วางแผนการดูแล"
                  }
                  tone="pink"
                />
                <PetSummaryCard
                  icon="finance"
                  title="น้ำหนักล่าสุด"
                  value={
                    latestWeight?.value
                      ? `${latestWeight.value} ${latestWeight.unit ?? ""}`
                      : "ยังไม่มีข้อมูล"
                  }
                  detail={
                    latestWeight
                      ? petCareDateLabel(latestWeight.recorded_at)
                      : "เริ่มติดตามน้ำหนัก"
                  }
                  tone="yellow"
                />
              </section>
              <p className="-mt-2 text-xs text-finance-muted">
                {SPECIES_LABEL[featured.species]}
                {featured.breed ? ` · ${featured.breed}` : ""}
                {featured.sex ? ` · ${SEX_LABEL[featured.sex]}` : ""}
                {age === null ? " · ยังไม่ระบุวันเกิด" : ` · อายุ ${age} ปี`}
              </p>
            </>
          ) : (
            <Card className="rounded-[1.5rem] bg-finance-surface-strong text-center">
              <p className="font-medium text-finance-text">
                ยังไม่มีสัตว์เลี้ยง
              </p>
              <p className="mt-1 text-sm text-finance-muted">
                เพิ่มสัตว์เลี้ยงเพื่อเริ่มบันทึกสุขภาพและการดูแล
              </p>
            </Card>
          )}
        </div>
      </div>

      {archived.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-finance-text">เก็บเข้าคลัง</h2>
          {archived.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function PetSummaryCard({
  icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: AppIconName;
  title: string;
  value: string;
  detail: string;
  tone: "green" | "blue" | "pink" | "yellow";
}) {
  const toneClass =
    tone === "green"
      ? "bg-[#e9f3df] text-[#5f8158]"
      : tone === "blue"
        ? "bg-[#e4f0f8] text-[#5685a1]"
        : tone === "pink"
          ? "bg-[#f8e5df] text-[#a8685c]"
          : "bg-[#f8efcf] text-[#9a7b32]";
  return (
    <Card className="min-w-0 rounded-[1.4rem] bg-finance-surface-strong p-3">
      <span
        className={`flex size-9 items-center justify-center rounded-full ${toneClass}`}
      >
        <AppIcon name={icon} className="size-4" />
      </span>
      <p className="mt-3 text-xs text-finance-muted">{title}</p>
      <p className="mt-0.5 line-clamp-2 font-semibold text-finance-text">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-finance-muted">{detail}</p>
    </Card>
  );
}
