"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { HouseholdMemberWithProfile } from "@/features/household/types";
import { initialActionState } from "@/lib/types/action-state";
import type { PetWithCaregivers } from "../types";
import { createPetAction, updatePetAction } from "../actions";

export function PetForm({
  members,
  pet,
  variant = "page",
}: {
  members: HouseholdMemberWithProfile[];
  pet?: PetWithCaregivers;
  /** Presentation only — no card chrome to strip either way (the page/sheet host provides it); kept for API-consistency. */
  variant?: "page" | "sheet";
}) {
  void variant;
  const [state, action] = useActionState(pet ? updatePetAction : createPetAction, initialActionState);
  const selected = new Set(pet?.caregivers.map((item) => item.id));
  return <form action={action} className="flex flex-col gap-4">
    {pet ? <input type="hidden" name="petId" value={pet.id} /> : null}
    <Field label="รูป" htmlFor="photo"><Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" /><span className="text-xs text-foreground-muted">JPEG, PNG หรือ WebP ไม่เกิน 15 MB</span></Field>
    <Field label="ชื่อ" htmlFor="name"><Input id="name" name="name" defaultValue={pet?.name} required maxLength={80} /></Field>
    <Field label="ประเภทสัตว์" htmlFor="species"><Select id="species" name="species" defaultValue={pet?.species ?? ""} required><option value="" disabled>เลือกประเภท</option><option value="CAT">แมว</option><option value="DOG">สุนัข</option><option value="RABBIT">กระต่าย</option><option value="BIRD">นก</option><option value="FISH">ปลา</option><option value="OTHER">อื่น ๆ</option></Select></Field>
    <Field label="สายพันธุ์" htmlFor="breed"><Input id="breed" name="breed" defaultValue={pet?.breed ?? ""} maxLength={100} /></Field>
    <Field label="เพศ" htmlFor="sex"><Select id="sex" name="sex" defaultValue={pet?.sex ?? ""}><option value="">ไม่ระบุ</option><option value="MALE">ผู้</option><option value="FEMALE">เมีย</option><option value="UNKNOWN">ไม่ทราบ</option></Select></Field>
    <Field label="วันเกิด" htmlFor="birthday"><Input id="birthday" name="birthday" type="date" defaultValue={pet?.birthday ?? ""} max={new Date().toISOString().slice(0,10)} /></Field>
    <fieldset><legend className="mb-2 text-sm font-medium text-foreground-muted">ผู้ดูแล</legend><div className="flex flex-col gap-2">{members.map((member) => { const name=member.profile?.display_name || member.profile?.email || "Member"; return <label key={member.id} className="flex min-h-11 items-center gap-3 rounded-control border border-border px-3"><input type="checkbox" name="caregiverIds" value={member.id} defaultChecked={selected.has(member.id)} />{name}</label>; })}</div></fieldset>
    {state.error ? <p aria-live="polite" className="text-sm text-danger">{state.error}</p> : null}
    <SubmitButton size="lg">{pet ? "บันทึก" : "เพิ่มสัตว์เลี้ยง"}</SubmitButton>
  </form>;
}
