import { describe, expect, it } from "vitest";

import {
  MAX_PET_DOCUMENT_BYTES,
  petCareRecordSchema,
  petDocumentPath,
  validatePetDocument,
} from "./care-record";

const base = {
  petId: "00000000-0000-4000-8000-000000000001",
  recordType: "HEALTH",
  title: " ตรวจสุขภาพ ",
  note: "",
  recordedAt: "2026-09-15T10:30",
  scheduledAt: "",
  value: "",
  unit: "",
  provider: "",
  transactionId: "",
};

describe("pet care record validation", () => {
  it("normalizes text and Bangkok local time", () => {
    const result = petCareRecordSchema.parse(base);
    expect(result.title).toBe("ตรวจสุขภาพ");
    expect(result.recordedAt).toBe("2026-09-15T03:30:00.000Z");
    expect(result.note).toBeNull();
  });

  it("requires a positive weight and keeps its unit", () => {
    expect(petCareRecordSchema.safeParse({ ...base, recordType: "WEIGHT", value: "0" }).success).toBe(false);
    expect(petCareRecordSchema.parse({ ...base, recordType: "WEIGHT", value: "4.25", unit: "kg" })).toMatchObject({ value: 4.25, unit: "kg" });
  });

  it("requires an existing finance transaction for expenses", () => {
    expect(petCareRecordSchema.safeParse({ ...base, recordType: "EXPENSE" }).success).toBe(false);
    expect(petCareRecordSchema.safeParse({ ...base, recordType: "EXPENSE", transactionId: "00000000-0000-4000-8000-000000000002" }).success).toBe(true);
  });

  it("calculates the next care date when an interval is selected", () => {
    const result = petCareRecordSchema.parse({
      ...base,
      recordType: "VACCINE",
      nextIntervalDays: "365",
    });
    expect(result.scheduledAt).toBe("2027-09-15T03:30:00.000Z");
  });
});

describe("pet care document rules", () => {
  it("allows supported files up to 15 MB", () => {
    expect(validatePetDocument({ type: "application/pdf", size: MAX_PET_DOCUMENT_BYTES })).toBeNull();
    expect(validatePetDocument({ type: "image/gif", size: 1 })).toMatch(/JPEG/);
    expect(validatePetDocument({ type: "image/png", size: MAX_PET_DOCUMENT_BYTES + 1 })).toMatch(/15 MB/);
  });

  it("scopes storage paths to household, pet, and record", () => {
    expect(petDocumentPath("household", "pet", "record", "application/pdf")).toBe("household/pet/record/document.pdf");
  });
});
