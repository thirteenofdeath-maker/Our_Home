"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { updateWalletAction } from "../actions";
import type { Wallet } from "../types";

export function RenameWalletForm({ wallet }: { wallet: Wallet }) {
  const [state, formAction] = useActionState(
    updateWalletAction,
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <input type="hidden" name="walletId" value={wallet.id} />

      <Field label="ชื่อกระเป๋าเงิน" htmlFor="wallet-name">
        <Input
          id="wallet-name"
          name="name"
          type="text"
          defaultValue={wallet.name}
          required
        />
      </Field>

      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton size="md">บันทึกการแก้ไข</SubmitButton>
    </form>
  );
}
