import type { Database } from "@/types/database";

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export interface CategoryNode extends Category {
  children: CategoryNode[];
}
