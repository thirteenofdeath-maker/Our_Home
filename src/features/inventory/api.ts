import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { InventoryDocument, InventoryItem } from "./types";

export async function listInventoryItems(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("category")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getInventoryItem(
  supabase: SupabaseClient<Database>,
  itemId: string,
): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", itemId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listInventoryDocuments(
  supabase: SupabaseClient<Database>,
  itemId: string,
): Promise<InventoryDocument[]> {
  const { data, error } = await supabase
    .from("inventory_documents")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (document) => {
      const signed = await supabase.storage
        .from("inventory-documents")
        .createSignedUrl(document.storage_path, 3600);
      return { ...document, url: signed.data?.signedUrl ?? "" };
    }),
  );
}
