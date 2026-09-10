"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { voidTransactionAction } from "../actions";

export function VoidTransactionForm({ transactionId, walletId }: { transactionId: string; walletId: string }) {
  const [state, formAction] = useActionState(voidTransactionAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="walletId" value={walletId} />
      <Input name="voidReason" type="text" placeholder="เหตุผล (ถ้ามี)" />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="md" variant="danger">
        ยกเลิกรายการ
      </SubmitButton>
    </form>
  );
}
