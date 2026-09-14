"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { MEMBER_COLORS } from "@/features/household/domain/member";
import { initialActionState } from "@/lib/types/action-state";
import type { ProfileGender } from "@/types/database";

import { updateProfileAction } from "../actions";
import { Avatar } from "./Avatar";

export function ProfileEditForm(props: {
  householdId: string;
  displayName: string;
  gender: ProfileGender | null;
  birthday: string | null;
  memberColor: string;
  avatarUrl: string | null;
}) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="householdId" value={props.householdId} />
      <div className="flex items-center gap-4">
        <Avatar displayName={props.displayName} url={props.avatarUrl} color={props.memberColor} size="lg" />
        <Field label="รูปโปรไฟล์" htmlFor="avatar">
          <Input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" />
          <span className="text-xs text-foreground-muted">JPEG, PNG หรือ WebP ไม่เกิน 15 MB</span>
        </Field>
      </div>
      <Field label="ชื่อที่แสดง" htmlFor="displayName">
        <Input id="displayName" name="displayName" defaultValue={props.displayName} required maxLength={80} />
      </Field>
      <Field label="เพศ" htmlFor="gender">
        <Select id="gender" name="gender" defaultValue={props.gender ?? ""}>
          <option value="">ไม่ระบุ</option>
          <option value="MALE">ชาย</option>
          <option value="FEMALE">หญิง</option>
          <option value="OTHER">อื่น ๆ</option>
          <option value="PREFER_NOT_TO_SAY">ไม่ประสงค์ระบุ</option>
        </Select>
      </Field>
      <Field label="วันเกิด" htmlFor="birthday">
        <Input id="birthday" name="birthday" type="date" defaultValue={props.birthday ?? ""} max={today} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground-muted">สีประจำสมาชิก</legend>
        <div className="flex flex-wrap gap-3">
          {MEMBER_COLORS.map((color) => (
            <label key={color} className="flex size-11 cursor-pointer items-center justify-center rounded-full focus-within:ring-2 focus-within:ring-primary">
              <input className="peer sr-only" type="radio" name="memberColor" value={color} defaultChecked={color === props.memberColor} required />
              <span className="size-8 rounded-full border-2 border-transparent peer-checked:border-foreground" style={{ backgroundColor: color }} />
            </label>
          ))}
        </div>
      </fieldset>
      {state.error ? <p aria-live="polite" className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">บันทึกโปรไฟล์</SubmitButton>
    </form>
  );
}
