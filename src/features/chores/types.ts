import type { ChoreCadence, Database } from "@/types/database";
import { CHORE_WEEKDAYS } from "./schedule";

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
  startsOn?: string,
) {
  if (intervalCount === 1 && startsOn && cadence === "WEEKLY") {
    const weekday = new Date(`${startsOn}T00:00:00.000Z`).getUTCDay();
    return `ทุก${CHORE_WEEKDAYS[weekday]}`;
  }
  if (intervalCount === 1 && startsOn && cadence === "MONTHLY") {
    const monthDay = new Date(`${startsOn}T00:00:00.000Z`).getUTCDate();
    return `ทุกวันที่ ${monthDay} ของเดือน`;
  }
  if (intervalCount === 1) return `ทุก${cadenceUnit[cadence]}`;
  return `ทุก ${intervalCount} ${cadenceUnit[cadence]}`;
}
