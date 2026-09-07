"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";

import { createPocket } from "./api";

const createPocketSchema = z.object({
  walletId: z.string().uuid(),
  name: z.string().trim().min(1, "Pocket name is required").max(60, "Keep it under 60 characters"),
});

export async function createPocketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = createPocketSchema.safeParse({
    walletId: formData.get("walletId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createPocket(supabase, { walletId: parsed.data.walletId, name: parsed.data.name });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create pocket" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  return {};
}
