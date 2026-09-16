import { z } from "zod";

import type { PetCareRecordType } from "@/types/database";

export const PET_CARE_RECORD_TYPES = [
  "HEALTH",
  "VACCINE",
  "MEDICATION",
  "VET",
  "WEIGHT",
  "EXPENSE",
  "DOCUMENT",
] as const satisfies readonly PetCareRecordType[];

export const PET_CARE_RECORD_LABEL: Record<PetCareRecordType, string> = {
  HEALTH: "สุขภาพ",
  VACCINE: "วัคซีน",
  MEDICATION: "ยา",
  VET: "นัดสัตวแพทย์",
  WEIGHT: "น้ำหนัก",
  EXPENSE: "ค่าใช้จ่าย",
  DOCUMENT: "เอกสาร",
};

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

const optionalDateTime = z
  .string()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
    "วันและเวลาไม่ถูกต้อง",
  )
  .transform((value) => (value ? new Date(`${value}:00+07:00`).toISOString() : null));

export const petCareRecordSchema = z
  .object({
    petId: z.string().uuid(),
    recordType: z.enum(PET_CARE_RECORD_TYPES),
    title: z.string().trim().min(1, "กรุณากรอกชื่อรายการ").max(160),
    note: optionalText(5000),
    recordedAt: optionalDateTime,
    scheduledAt: optionalDateTime,
    value: z.string().trim(),
    unit: optionalText(24),
    provider: optionalText(160),
    transactionId: z.union([z.string().uuid(), z.literal("")]).transform((value) => value || null),
  })
  .superRefine((value, context) => {
    if (value.recordType === "WEIGHT") {
      const weight = Number(value.value);
      if (!Number.isFinite(weight) || weight <= 0) {
        context.addIssue({ code: "custom", path: ["value"], message: "กรุณากรอกน้ำหนักมากกว่า 0" });
      }
    }
    if (value.recordType === "EXPENSE" && !value.transactionId) {
      context.addIssue({ code: "custom", path: ["transactionId"], message: "กรุณาเลือกรายการการเงิน" });
    }
  })
  .transform((value) => ({
    ...value,
    recordedAt: value.recordedAt ?? new Date().toISOString(),
    value: value.recordType === "WEIGHT" ? Number(value.value) : null,
    unit: value.recordType === "WEIGHT" ? value.unit ?? "kg" : null,
    transactionId: value.recordType === "EXPENSE" ? value.transactionId : null,
  }));

export const PET_DOCUMENT_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export const MAX_PET_DOCUMENT_BYTES = 15 * 1024 * 1024;

export function validatePetDocument(file: Pick<File, "size" | "type">) {
  if (!(file.type in PET_DOCUMENT_MIME_EXTENSIONS)) return "รองรับ JPEG, PNG, WebP หรือ PDF";
  if (file.size > MAX_PET_DOCUMENT_BYTES) return "ไฟล์ต้องมีขนาดไม่เกิน 15 MB";
  return null;
}

export function petDocumentPath(
  householdId: string,
  petId: string,
  recordId: string,
  mime: keyof typeof PET_DOCUMENT_MIME_EXTENSIONS,
) {
  return `${householdId}/${petId}/${recordId}/document.${PET_DOCUMENT_MIME_EXTENSIONS[mime]}`;
}

export function bangkokDateTimeInput(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  })
    .format(new Date(value))
    .replace(" ", "T");
}

export function petCareDateLabel(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}
