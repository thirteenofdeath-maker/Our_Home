import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { ShoppingItem } from "./types";

export async function listShoppingItems(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("purchased_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getShoppingItem(
  supabase: SupabaseClient<Database>,
  itemId: string,
): Promise<ShoppingItem | null> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("id", itemId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createShoppingItem(
  supabase: SupabaseClient<Database>,
  params: {
    householdId: string;
    name: string;
    note: string | null;
    store: string | null;
    quantity: string;
    unit: string | null;
    estimatedAmount: string | null;
    currency: string;
    assignedMemberId: string | null;
  },
) {
  const { error } = await supabase.rpc("create_shopping_item", {
    p_household_id: params.householdId,
    p_name: params.name,
    p_note: params.note,
    p_store: params.store,
    p_quantity: params.quantity,
    p_unit: params.unit,
    p_estimated_amount: params.estimatedAmount,
    p_currency: params.currency,
    p_assigned_member_id: params.assignedMemberId,
  });
  if (error) throw error;
}

export async function setShoppingItemPurchased(
  supabase: SupabaseClient<Database>,
  itemId: string,
  purchased: boolean,
) {
  const { error } = await supabase.rpc("set_shopping_item_purchased", {
    p_item_id: itemId,
    p_purchased: purchased,
  });
  if (error) throw error;
}

export async function setShoppingItemArchived(
  supabase: SupabaseClient<Database>,
  itemId: string,
) {
  const { error } = await supabase.rpc("set_shopping_item_archived", {
    p_item_id: itemId,
    p_archived: true,
  });
  if (error) throw error;
}
