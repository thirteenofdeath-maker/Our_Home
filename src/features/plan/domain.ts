import { z } from "zod";

export const planScopeSchema = z.enum(["PERSONAL", "HOUSEHOLD"]);
export const planTaskPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH"]);
export const planNoteColorSchema = z.enum(["SAGE", "SKY", "SAND", "ROSE", "LILAC", "WHITE"]);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    z.string().max(max).nullable(),
  );

export const planTaskFormSchema = z
  .object({
    title: z.string().trim().min(1, "กรอกชื่องาน").max(160),
    details: optionalText(5000),
    listName: z.string().trim().min(1).max(80).default("งานของฉัน"),
    scope: planScopeSchema,
    dueDate: z.preprocess(
      (value) => (typeof value === "string" && value ? value : null),
      z.iso.date().nullable(),
    ),
    dueTime: z.preprocess(
      (value) => (typeof value === "string" && value ? value : null),
      z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    ),
    priority: planTaskPrioritySchema,
  })
  .refine((value) => !value.dueTime || value.dueDate, {
    message: "เลือกวันที่ก่อนกำหนดเวลา",
    path: ["dueDate"],
  });

export const planNoteFormSchema = z.object({
  title: optionalText(160),
  content: optionalText(20000),
  scope: planScopeSchema,
  color: planNoteColorSchema,
}).refine((value) => Boolean(value.title || value.content), {
  message: "ใส่หัวข้อหรือข้อความอย่างน้อยหนึ่งอย่าง",
  path: ["content"],
});

export const planTaskStepSchema = z.object({
  title: z.string().trim().min(1, "กรอกรายการย่อย").max(240),
});

export function planDateLabel(date: string | null, time: string | null) {
  if (!date) return "ไม่มีกำหนด";
  const label = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  return time ? `${label} · ${time.slice(0, 5)} น.` : label;
}

export const priorityLabel = {
  LOW: "ต่ำ",
  NORMAL: "ปกติ",
  HIGH: "สำคัญ",
} as const;

export const noteColorClass = {
  SAGE: "bg-primary-soft/70",
  SKY: "bg-[#e8f2f8]",
  SAND: "bg-[#f7eedc]",
  ROSE: "bg-[#f8e7e3]",
  LILAC: "bg-[#f0e8f4]",
  WHITE: "bg-surface",
} as const;
