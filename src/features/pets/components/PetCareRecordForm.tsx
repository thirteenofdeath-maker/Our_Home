"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FinanceRecentTransaction } from "@/features/finance/types";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

import {
  createPetCareRecordAction,
  updatePetCareRecordAction,
} from "../actions";
import {
  PET_CARE_RECORD_LABEL,
  PET_CARE_RECORD_TYPES,
  bangkokDateTimeInput,
} from "../domain/care-record";
import type { PetCareRecordWithDocument } from "../types";

export function PetCareRecordForm({
  petId,
  transactions,
  record,
}: {
  petId: string;
  transactions: FinanceRecentTransaction[];
  record?: PetCareRecordWithDocument;
}) {
  const [state, action] = useActionState(
    record ? updatePetCareRecordAction : createPetCareRecordAction,
    initialActionState,
  );
  const [type, setType] = useState<(typeof PET_CARE_RECORD_TYPES)[number]>(
    record?.record_type ?? "HEALTH",
  );
  useCloseFormSheetOnSuccess(state.success);
  const suffix = record?.id ?? "new";
  const hasCurrentTransaction = transactions.some(
    (transaction) => transaction.transactionId === record?.transaction_id,
  );

  return (
    <form
      action={action}
      className="finance-ui-tone flex min-w-0 flex-col gap-4"
    >
      <input type="hidden" name="petId" value={petId} />
      {record ? (
        <input type="hidden" name="recordId" value={record.id} />
      ) : null}
      <Field label="ประเภทบันทึก" htmlFor={`pet-care-type-${suffix}`}>
        <Select
          id={`pet-care-type-${suffix}`}
          name="recordType"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
        >
          {PET_CARE_RECORD_TYPES.map((value) => (
            <option key={value} value={value}>
              {PET_CARE_RECORD_LABEL[value]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="ชื่อรายการ" htmlFor={`pet-care-title-${suffix}`}>
        <Input
          id={`pet-care-title-${suffix}`}
          name="title"
          required
          maxLength={160}
          placeholder="เช่น วัคซีนรวมประจำปี"
          defaultValue={record?.title}
        />
      </Field>
      <Field label="รายละเอียด" htmlFor={`pet-care-note-${suffix}`}>
        <Textarea
          id={`pet-care-note-${suffix}`}
          name="note"
          maxLength={5000}
          placeholder="ผลตรวจ วิธีใช้ยา หรือรายละเอียดเพิ่มเติม"
          defaultValue={record?.note ?? ""}
        />
      </Field>
      <Field label="วันที่บันทึก" htmlFor={`pet-care-recorded-at-${suffix}`}>
        <Input
          id={`pet-care-recorded-at-${suffix}`}
          name="recordedAt"
          type="datetime-local"
          defaultValue={bangkokDateTimeInput(
            record?.recorded_at ?? new Date().toISOString(),
          )}
        />
      </Field>
      {type === "VACCINE" || type === "MEDICATION" || type === "VET" ? (
        <>
          <Field
            label="สร้างกำหนดครั้งถัดไปอัตโนมัติ"
            htmlFor={`pet-care-next-interval-${suffix}`}
          >
            <Select
              id={`pet-care-next-interval-${suffix}`}
              name="nextIntervalDays"
              defaultValue=""
            >
              <option value="">ไม่สร้างอัตโนมัติ</option>
              <option value="7">อีก 7 วัน</option>
              <option value="30">อีก 30 วัน</option>
              <option value="90">อีก 3 เดือน</option>
              <option value="180">อีก 6 เดือน</option>
              <option value="365">อีก 1 ปี</option>
            </Select>
          </Field>
          <Field
            label="หรือกำหนดวันและเวลาเอง"
            htmlFor={`pet-care-scheduled-at-${suffix}`}
          >
            <Input
              id={`pet-care-scheduled-at-${suffix}`}
              name="scheduledAt"
              type="datetime-local"
              defaultValue={bangkokDateTimeInput(record?.scheduled_at)}
            />
          </Field>
        </>
      ) : (
        <>
          <input type="hidden" name="scheduledAt" value="" />
          <input type="hidden" name="nextIntervalDays" value="" />
        </>
      )}
      {type === "WEIGHT" ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(5.5rem,1fr)] gap-3 [&>*]:min-w-0">
          <Field label="น้ำหนัก" htmlFor={`pet-care-value-${suffix}`}>
            <Input
              id={`pet-care-value-${suffix}`}
              name="value"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              defaultValue={record?.value?.toString() ?? ""}
            />
          </Field>
          <Field label="หน่วย" htmlFor={`pet-care-unit-${suffix}`}>
            <Select
              id={`pet-care-unit-${suffix}`}
              name="unit"
              defaultValue={record?.unit ?? "kg"}
            >
              <option value="kg">กก.</option>
              <option value="g">กรัม</option>
            </Select>
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="value" value="" />
          <input type="hidden" name="unit" value="" />
        </>
      )}
      {type === "HEALTH" ||
      type === "VACCINE" ||
      type === "MEDICATION" ||
      type === "VET" ? (
        <Field
          label="คลินิก / ผู้ให้บริการ (ไม่บังคับ)"
          htmlFor={`pet-care-provider-${suffix}`}
        >
          <Input
            id={`pet-care-provider-${suffix}`}
            name="provider"
            maxLength={160}
            defaultValue={record?.provider ?? ""}
          />
        </Field>
      ) : (
        <input type="hidden" name="provider" value="" />
      )}
      {type === "EXPENSE" ? (
        <Field
          label="เชื่อมกับรายการการเงิน"
          htmlFor={`pet-care-transaction-${suffix}`}
        >
          <Select
            id={`pet-care-transaction-${suffix}`}
            name="transactionId"
            required
            defaultValue={record?.transaction_id ?? ""}
          >
            <option value="" disabled>
              เลือกรายการ
            </option>
            {record?.transaction_id && !hasCurrentTransaction ? (
              <option value={record.transaction_id}>รายการการเงินเดิม</option>
            ) : null}
            {transactions.map((transaction) => (
              <option
                key={transaction.transactionId}
                value={transaction.transactionId}
              >
                {transaction.title ??
                  transaction.categoryName ??
                  "รายการการเงิน"}{" "}
                · {formatCurrency(transaction.amount, transaction.currency)}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="transactionId" value="" />
      )}
      {record ? (
        <p className="rounded-control bg-finance-primary-soft px-4 py-3 text-sm text-finance-muted">
          {record.document_path
            ? "เอกสารเดิมจะยังคงอยู่"
            : "บันทึกนี้ไม่มีเอกสารแนบ"}
        </p>
      ) : (
        <Field
          label="เอกสารหรือรูปภาพ (ไม่บังคับ)"
          htmlFor={`pet-care-document-${suffix}`}
        >
          <Input
            id={`pet-care-document-${suffix}`}
            name="document"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
          />
          <span className="text-xs text-finance-muted">
            JPEG, PNG, WebP หรือ PDF ไม่เกิน 15 MB
          </span>
        </Field>
      )}
      {state.error ? (
        <p className="text-sm text-danger" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {record ? "บันทึกการแก้ไข" : "เพิ่มบันทึก"}
      </SubmitButton>
    </form>
  );
}
