"use client";

import { useActionState, useState } from "react";

import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { createPocketAction } from "../actions";

export function AddPocketForm({ walletId }: { walletId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createPocketAction, initialActionState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-left text-sm font-medium text-primary">
        + เพิ่มช่อง (Pocket)
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="walletId" value={walletId} />
      <div className="flex-1">
        <Input name="name" placeholder="เช่น Bills, Food" required autoFocus />
      </div>
      <SubmitButton size="md" className="w-auto px-4">
        เพิ่ม
      </SubmitButton>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
