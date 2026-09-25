"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { MemberColorInput } from "@/features/household/components/MemberColorInput";
import { initialActionState } from "@/lib/types/action-state";
import { bangkokDateKey } from "@/lib/date/bangkok";
import type { ProfileGender } from "@/types/database";

import { updateProfileAction } from "../actions";
import { Avatar } from "./Avatar";

export function ProfileEditForm(props: {
  householdId: string;
  displayName: string;
  gender: ProfileGender | null;
  birthday: string | null;
  shareBirthdayWithHousehold: boolean;
  memberColor: string;
  avatarUrl: string | null;
}) {
  const [state, action] = useActionState(
    updateProfileAction,
    initialActionState,
  );
  const today = bangkokDateKey();
  return (
    <form action={action} className="flex min-w-0 max-w-full flex-col gap-4">
      <input type="hidden" name="householdId" value={props.householdId} />
      <div className="flex min-w-0 max-w-full items-center gap-4">
        <Avatar
          displayName={props.displayName}
          url={props.avatarUrl}
          color={props.memberColor}
          size="lg"
        />
        <Field label="รูปโปรไฟล์" htmlFor="avatar">
          <Input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <span className="text-xs text-foreground-muted">
            JPEG, PNG หรือ WebP ไม่เกิน 15 MB
          </span>
        </Field>
      </div>
      <Field label="ชื่อที่แสดง" htmlFor="displayName">
        <Input
          id="displayName"
          name="displayName"
          defaultValue={props.displayName}
          required
          maxLength={80}
        />
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
        <Input
          id="birthday"
          name="birthday"
          type="date"
          defaultValue={props.birthday ?? ""}
          max={today}
        />
      </Field>
      <label className="flex min-h-14 items-start gap-3 rounded-control border border-border p-3">
        <input
          className="mt-1 size-5 accent-[var(--primary)]"
          type="checkbox"
          name="shareBirthdayWithHousehold"
          defaultChecked={props.shareBirthdayWithHousehold}
        />
        <span>
          <span className="block font-medium">แชร์วันเกิดกับครอบครัว</span>
          <span className="mt-1 block text-sm text-foreground-muted">
            ใช้ส่งคำเตือนวันเกิดให้สมาชิก โดยไม่เปิดเผยปีเกิด
          </span>
        </span>
      </label>
      <MemberColorInput defaultValue={props.memberColor} />
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">บันทึกโปรไฟล์</SubmitButton>
    </form>
  );
}
