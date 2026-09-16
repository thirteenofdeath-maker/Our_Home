import type { Database } from "@/types/database";

export type PlanTask = Database["public"]["Tables"]["plan_tasks"]["Row"];
export type PlanTaskStep =
  Database["public"]["Tables"]["plan_task_steps"]["Row"];
export type PlanNote = Database["public"]["Tables"]["plan_notes"]["Row"];
export type PlanReminder =
  Database["public"]["Tables"]["plan_reminders"]["Row"];
