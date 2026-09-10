import type { Database } from "@/types/database";

export type Tag = Database["public"]["Tables"]["tags"]["Row"];

export interface TagOption {
  id: string;
  name: string;
}
