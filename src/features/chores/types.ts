import type { ChoreCadence, Database } from "@/types/database";

export type ChoreTemplate =
  Database["public"]["Tables"]["chore_templates"]["Row"];
export type ChoreTemplateAssignee =
  Database["public"]["Tables"]["chore_template_assignees"]["Row"];
export type ChoreOccurrence =
  Database["public"]["Tables"]["chore_occurrences"]["Row"];

const cadenceUnit: Record<ChoreCadence, string> = {
  DAILY: "วัน",
  WEEKLY: "สัปดาห์",
  MONTHLY: "เดือน",
  YEARLY: "ปี",
};

export function choreCadenceLabel(
  cadence: ChoreCadence,
  intervalCount: number,
) {
  if (intervalCount === 1) return `ทุก${cadenceUnit[cadence]}`;
  return `ทุก ${intervalCount} ${cadenceUnit[cadence]}`;
}
