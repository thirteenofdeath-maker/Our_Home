import { z } from "zod";

import { financeOccurredAtToIso } from "../domain/occurred-at";

export const financeOccurredAtSchema = z
  .string()
  .trim()
  .min(1, "กรุณาเลือกวันที่และเวลา")
  .transform((value, context) => {
    const occurredAt = financeOccurredAtToIso(value);
    if (!occurredAt) {
      context.addIssue({
        code: "custom",
        message: "วันที่หรือเวลาไม่ถูกต้อง",
      });
      return z.NEVER;
    }
    return occurredAt;
  });
