"use client";

import { useActionState } from "react";

import { Field, Input, TwoColumnFieldGrid } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { updateCreditCardCycleAction } from "../actions";
import type { CreditCardAccountOption } from "../types";

export function CreditCardCycleForm({
  account,
}: {
  account: CreditCardAccountOption;
}) {
  const [state, action] = useActionState(
    updateCreditCardCycleAction,
    initialActionState,
  );

  return (
    <form
      action={action}
      className="finance-ui-tone flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <input type="hidden" name="accountId" value={account.accountId} />
      <input type="hidden" name="walletId" value={account.walletId} />

      <TwoColumnFieldGrid>
        <Field label="วันตัดยอด" htmlFor="credit-card-statement-closing-day">
          <Input
            id="credit-card-statement-closing-day"
            name="statementClosingDay"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            defaultValue={account.statementClosingDay}
            required
          />
        </Field>
        <Field label="วันครบกำหนด" htmlFor="credit-card-payment-due-day">
          <Input
            id="credit-card-payment-due-day"
            name="paymentDueDay"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            defaultValue={account.paymentDueDay}
            required
          />
        </Field>
      </TwoColumnFieldGrid>

      <p className="text-xs leading-relaxed text-finance-muted">
        หากเดือนไหนไม่มีวันที่เลือก ระบบจะใช้วันสุดท้ายของเดือนนั้น
      </p>
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : state.success ? (
        <p className="text-sm text-finance-income">บันทึกรอบบัตรแล้ว</p>
      ) : null}
      <SubmitButton size="md">บันทึกรอบบัตร</SubmitButton>
    </form>
  );
}
