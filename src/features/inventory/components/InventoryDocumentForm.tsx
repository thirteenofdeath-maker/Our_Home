"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { uploadInventoryDocumentAction } from "../actions";

export function InventoryDocumentForm({
  householdId,
  itemId,
}: {
  householdId: string;
  itemId: string;
}) {
  const [state, action] = useActionState(
    uploadInventoryDocumentAction,
    initialActionState,
  );
  useCloseFormSheetOnSuccess(state.success);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="itemId" value={itemId} />
      <Field label="ชื่อเอกสาร" htmlFor="document-title">
        <Input
          id="document-title"
          name="title"
          maxLength={160}
          required
          autoFocus
          placeholder="เช่น ใบเสร็จวันที่ซื้อ"
        />
      </Field>
      <Field label="ประเภท" htmlFor="document-type">
        <Select id="document-type" name="documentType" defaultValue="RECEIPT">
          <option value="RECEIPT">ใบเสร็จ</option>
          <option value="MANUAL">คู่มือ</option>
          <option value="WARRANTY">เอกสารประกัน</option>
          <option value="OTHER">เอกสารอื่น</option>
        </Select>
      </Field>
      <Field label="ไฟล์ (ไม่เกิน 6 MB)" htmlFor="document-file">
        <Input
          id="document-file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
        />
      </Field>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">อัปโหลดเอกสาร</SubmitButton>
    </form>
  );
}
