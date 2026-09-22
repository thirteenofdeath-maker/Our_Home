import type { Database } from "@/types/database";

export type ChoreTemplate = Database["public"]["Tables"]["chore_templates"]["Row"];
export type ChoreTemplateAssignee = Database["public"]["Tables"]["chore_template_assignees"]["Row"];
export type ChoreOccurrence = Database["public"]["Tables"]["chore_occurrences"]["Row"];

