"use client";

import { type FormEvent, useActionState, useState, useTransition } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { HouseholdMemberWithProfile } from "@/features/household/types";
import { initialActionState } from "@/lib/types/action-state";
import { bangkokDateKey } from "@/lib/date/bangkok";
import type { PetWithCaregivers } from "../types";
import { createPetAction, updatePetAction } from "../actions";
import { preparePetPhotoForUpload } from "../domain/photo-compression";

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
  const [clientError, setClientError] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [actionPending, startAction] = useTransition();
  const selected = new Set(pet?.caregivers.map((item) => item.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preparingPhoto || actionPending) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const selectedPhoto = formData.get("photo");
    setClientError(null);

    try {
      if (selectedPhoto instanceof File && selectedPhoto.size > 0) {
        setPreparingPhoto(true);
        formData.set("photo", await preparePetPhotoForUpload(selectedPhoto));
      }
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "ไม่สามารถเตรียมรูปได้",
      );
      return;
    } finally {
      setPreparingPhoto(false);
    }

    startAction(() => action(formData));
  }

  return <form onSubmit={submit} className="finance-ui-tone flex flex-col gap-4">
    {pet ? <input type="hidden" name="petId" value={pet.id} /> : null}
    <Field label="รูป" htmlFor="photo"><Input id="photo" name="photo" type="file" accept="image/*,.heic,.heif" /><span className="text-xs text-foreground-muted">JPEG, PNG, WebP, HEIC หรือ HEIF ไม่เกิน 15 MB · ระบบย่อรูปให้อัตโนมัติ</span></Field>
    <Field label="ชื่อ" htmlFor="name"><Input id="name" name="name" defaultValue={pet?.name} required maxLength={80} /></Field>
    <Field label="ประเภทสัตว์" htmlFor="species"><Select id="species" name="species" defaultValue={pet?.species ?? ""} required><option value="" disabled>เลือกประเภท</option><option value="CAT">แมว</option><option value="DOG">สุนัข</option><option value="RABBIT">กระต่าย</option><option value="BIRD">นก</option><option value="FISH">ปลา</option><option value="OTHER">อื่น ๆ</option></Select></Field>
    <Field label="สายพันธุ์" htmlFor="breed"><Input id="breed" name="breed" defaultValue={pet?.breed ?? ""} maxLength={100} /></Field>
    <Field label="เพศ" htmlFor="sex"><Select id="sex" name="sex" defaultValue={pet?.sex ?? ""}><option value="">ไม่ระบุ</option><option value="MALE">ผู้</option><option value="FEMALE">เมีย</option><option value="UNKNOWN">ไม่ทราบ</option></Select></Field>
    <Field label="วันเกิด" htmlFor="birthday"><Input id="birthday" name="birthday" type="date" defaultValue={pet?.birthday ?? ""} max={bangkokDateKey()} /></Field>
    <fieldset><legend className="mb-2 text-sm font-medium text-foreground-muted">ผู้ดูแล</legend><div className="flex flex-col gap-2">{members.map((member) => { const name=member.profile?.display_name || member.profile?.email || "Member"; return <label key={member.id} className="flex min-h-11 items-center gap-3 rounded-control border border-border px-3"><input type="checkbox" name="caregiverIds" value={member.id} defaultChecked={selected.has(member.id)} />{name}</label>; })}</div></fieldset>
    {clientError || state.error ? <p aria-live="polite" className="text-sm text-danger">{clientError ?? state.error}</p> : null}
    <SubmitButton size="lg" disabled={preparingPhoto || actionPending}>{preparingPhoto ? "กำลังย่อรูป..." : pet ? "บันทึก" : "เพิ่มสัตว์เลี้ยง"}</SubmitButton>
  </form>;
}
