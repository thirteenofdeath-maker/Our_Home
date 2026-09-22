import type { Database } from "@/types/database";

export type ShoppingItem =
  Database["public"]["Tables"]["shopping_items"]["Row"];
