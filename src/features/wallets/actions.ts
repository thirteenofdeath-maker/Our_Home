"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";

import { createWallet } from "./api";

const walletTypeSchema = z.enum(["BANK", "CASH", "CREDIT_CARD", "E_WALLET", "OTHER"]);

const createWalletSchema = z.object({
  name: z.string().trim().min(1, "Wallet name is required").max(80, "Keep it under 80 characters"),
  walletType: walletTypeSchema,
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code, e.g. THB")
    .transform((v) => v.toUpperCase()),
  scope: z.enum(["PERSONAL", "HOUSEHOLD"]),
});

export async function createWalletAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createWalletSchema.safeParse({
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currency: formData.get("currency") || "THB",
    scope: formData.get("scope"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let householdId: string | null = null;
  if (parsed.data.scope === "HOUSEHOLD") {
    const household = await getMyPrimaryHousehold(supabase, user.id);
    if (!household) {
      return { error: "Create a household first before adding a household wallet" };
    }
    householdId = household.id;
  }

  let wallet;
  try {
    wallet = await createWallet(supabase, {
      name: parsed.data.name,
      walletType: parsed.data.walletType,
      currency: parsed.data.currency,
      scope: parsed.data.scope,
      ownerUserId: parsed.data.scope === "PERSONAL" ? user.id : null,
      householdId,
      createdBy: user.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create wallet" };
  }

  redirect(`/wallets/${wallet.id}`);
}
