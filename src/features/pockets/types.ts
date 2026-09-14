import type { Database } from "@/types/database";

export type Pocket = Database["public"]["Tables"]["pockets"]["Row"];

export interface PocketWithBalance extends Pocket {
  balance: string;
}
