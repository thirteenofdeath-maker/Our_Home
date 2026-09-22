"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FinanceRecentTransaction } from "@/features/finance/types";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

import { createPetCareRecordAction } from "../actions";
import { PET_CARE_RECORD_LABEL, PET_CARE_RECORD_TYPES, bangkokDateTimeInput } from "../domain/care-record";

export function PetCareRecordForm({
  petId,
  transactions,
}: {
  petId: string;
  transactions: FinanceRecentTransaction[];
}) {
  const [state, action] = useActionState(createPetCareRecordAction, initialActionState);
  const [type, setType] = useState<(typeof PET_CARE_RECORD_TYPES)[number]>("HEALTH");
  useCloseFormSheetOnSuccess(state.success);

  return (
    <form action={action} className="finance-ui-tone flex min-w-0 flex-col gap-4">
      <input type="hidden" name="petId" value={petId} />
      <Field label="ประเภทบันทึก" htmlFor="pet-care-type">
        <Select
          id="pet-care-type"
          name="recordType"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
        >
          {PET_CARE_RECORD_TYPES.map((value) => (
            <option key={value} value={value}>{PET_CARE_RECORD_LABEL[value]}</option>
          ))}
        </Select>
      </Field>
      <Field label="ชื่อรายการ" htmlFor="pet-care-title">
        <Input id="pet-care-title" name="title" required maxLength={160} placeholder="เช่น วัคซีนรวมประจำปี" />
      </Field>
      <Field label="รายละเอียด" htmlFor="pet-care-note">
        <Textarea id="pet-care-note" name="note" maxLength={5000} placeholder="ผลตรวจ วิธีใช้ยา หรือรายละเอียดเพิ่มเติม" />
      </Field>
      <Field label="วันที่บันทึก" htmlFor="pet-care-recorded-at">
        <Input id="pet-care-recorded-at" name="recordedAt" type="datetime-local" defaultValue={bangkokDateTimeInput(new Date().toISOString())} />
      </Field>
      {(type === "VACCINE" || type === "MEDICATION" || type === "VET") ? (
        <>
          <Field label="สร้างกำหนดครั้งถัดไปอัตโนมัติ" htmlFor="pet-care-next-interval">
            <Select id="pet-care-next-interval" name="nextIntervalDays" defaultValue="">
              <option value="">ไม่สร้างอัตโนมัติ</option>
              <option value="7">อีก 7 วัน</option>
              <option value="30">อีก 30 วัน</option>
              <option value="90">อีก 3 เดือน</option>
              <option value="180">อีก 6 เดือน</option>
              <option value="365">อีก 1 ปี</option>
            </Select>
          </Field>
          <Field label="หรือกำหนดวันและเวลาเอง" htmlFor="pet-care-scheduled-at">
            <Input id="pet-care-scheduled-at" name="scheduledAt" type="datetime-local" />
          </Field>
        </>
      ) : <><input type="hidden" name="scheduledAt" value="" /><input type="hidden" name="nextIntervalDays" value="" /></>}
      {type === "WEIGHT" ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(5.5rem,1fr)] gap-3 [&>*]:min-w-0">
          <Field label="น้ำหนัก" htmlFor="pet-care-value">
            <Input id="pet-care-value" name="value" type="number" inputMode="decimal" min="0.01" step="0.01" required />
          </Field>
          <Field label="หน่วย" htmlFor="pet-care-unit">
            <Select id="pet-care-unit" name="unit" defaultValue="kg">
              <option value="kg">กก.</option>
              <option value="g">กรัม</option>
            </Select>
          </Field>
        </div>
      ) : <><input type="hidden" name="value" value="" /><input type="hidden" name="unit" value="" /></>}
      {(type === "HEALTH" || type === "VACCINE" || type === "MEDICATION" || type === "VET") ? (
        <Field label="คลินิก / ผู้ให้บริการ (ไม่บังคับ)" htmlFor="pet-care-provider">
          <Input id="pet-care-provider" name="provider" maxLength={160} />
        </Field>
      ) : <input type="hidden" name="provider" value="" />}
      {type === "EXPENSE" ? (
        <Field label="เชื่อมกับรายการการเงิน" htmlFor="pet-care-transaction">
          <Select id="pet-care-transaction" name="transactionId" required defaultValue="">
            <option value="" disabled>เลือกรายการ</option>
            {transactions.map((transaction) => (
              <option key={transaction.transactionId} value={transaction.transactionId}>
                {transaction.title ?? transaction.categoryName ?? "รายการการเงิน"} · {formatCurrency(transaction.amount, transaction.currency)}
              </option>
            ))}
          </Select>
        </Field>
      ) : <input type="hidden" name="transactionId" value="" />}
      <Field label="เอกสารหรือรูปภาพ (ไม่บังคับ)" htmlFor="pet-care-document">
        <Input id="pet-care-document" name="document" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
        <span className="text-xs text-finance-muted">JPEG, PNG, WebP หรือ PDF ไม่เกิน 15 MB</span>
      </Field>
      {state.error ? <p className="text-sm text-danger" aria-live="polite">{state.error}</p> : null}
      <SubmitButton size="lg">เพิ่มบันทึก</SubmitButton>
    </form>
  );
}
