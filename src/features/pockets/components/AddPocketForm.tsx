"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { cn } from "@/lib/utils/cn";

import { createPocketAction } from "../actions";

export function AddPocketForm({ walletId, variant = "page" }: { walletId: string; variant?: "page" | "sheet" }) {
  const [state, formAction] = useActionState(createPocketAction, initialActionState);

  return (
    <form
      action={formAction}
      className={cn("finance-ui-tone", variant === "sheet" ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card")}
    >
      <input type="hidden" name="walletId" value={walletId} />
      <Input id="name" name="name" placeholder="เช่น Food, Travel" required autoFocus />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">
        เพิ่ม Pocket
      </SubmitButton>
    </form>
  );
}
