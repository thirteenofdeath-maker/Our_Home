"use client";

import { useActionState, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import {
  buildFinancePocketOptions,
  FinancePocketField,
} from "@/features/finance/components/FinancePocketPicker";
import type { PocketWithBalance } from "@/features/pockets/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";

import { payInstallmentAction } from "../actions";

export function PayInstallmentForm({
  id,
  amount,
  categoryId,
  wallets,
  pockets,
}: {
  id: string;
  amount: string;
  categoryId: string;
  wallets: Wallet[];
  pockets: Record<string, PocketWithBalance[]>;
}) {
  const [state, action] = useActionState(
    payInstallmentAction,
    initialActionState,
  );
  const options = buildFinancePocketOptions(wallets, pockets);
  const [pocketId, setPocketId] = useState(options[0]?.pocketId ?? "");

  return (
    <form action={action} className="finance-ui-tone flex flex-col gap-4">
      <input type="hidden" name="occurrenceId" value={id} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <Field label="ยอดงวด" htmlFor="amount">
        <Input id="amount" name="amount" value={amount} readOnly />
      </Field>
      <FinancePocketField
        options={options}
        selectedPocketId={pocketId}
        onSelect={(option) => setPocketId(option.pocketId)}
      />
      <Field label="วันที่จ่าย" htmlFor="occurredAt">
        <Input
          id="occurredAt"
          name="occurredAt"
          type="date"
          defaultValue={bangkokDateKey()}
          required
        />
      </Field>
      {state.error ? <p className="text-danger">{state.error}</p> : null}
      <SubmitButton>จ่ายงวดนี้</SubmitButton>
    </form>
  );
}
