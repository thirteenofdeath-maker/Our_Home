"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Pocket } from "@/features/pockets/types";
import { initialActionState } from "@/lib/types/action-state";

import { createPocketTransferAction } from "../actions";

export function PocketTransferForm({ walletId, pockets }: { walletId: string; pockets: Pocket[] }) {
  const [state, formAction] = useActionState(createPocketTransferAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="walletId" value={walletId} />

      <Field label="จากช่อง" htmlFor="fromPocketId">
        <Select id="fromPocketId" name="fromPocketId" required>
          {pockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ไปยังช่อง" htmlFor="toPocketId">
        <Select id="toPocketId" name="toPocketId" required defaultValue={pockets[1]?.id}>
          {pockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">โอนเงิน</SubmitButton>
    </form>
  );
}
