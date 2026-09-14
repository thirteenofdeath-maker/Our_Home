"use client";

import { useActionState, useEffect, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { createCreditCardAction, updateCreditCardAction } from "../actions";
import type { CreditCardAccount } from "../types";

export function CreditCardForm({
  card,
  hasHousehold,
}: {
  card?: CreditCardAccount;
  hasHousehold: boolean;
}) {
  const action = card ? updateCreditCardAction : createCreditCardAction;
  const [state, formAction] = useActionState(action, initialActionState);
  const [scope, setScope] = useState<"PERSONAL" | "HOUSEHOLD" | null>(
    card?.scope ?? null,
  );
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <form
      action={formAction}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card"
    >
      {card ? (
        <input type="hidden" name="accountId" value={card.accountId} />
      ) : null}
      {!card ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-finance-muted">
            ใช้บัตรแบบไหน
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["PERSONAL", "HOUSEHOLD"] as const).map((value) => (
              <label
                key={value}
                className={`rounded-control border p-3 text-center text-sm ${scope === value ? "border-finance-primary bg-finance-primary-soft" : "border-border"}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  disabled={value === "HOUSEHOLD" && !hasHousehold}
                />
                {value === "PERSONAL"
                  ? "ส่วนตัว"
                  : `ครอบครัว${!hasHousehold ? " (ยังไม่มีครอบครัว)" : ""}`}
              </label>
            ))}
          </div>
          {!scope ? (
            <p className="text-xs text-finance-muted">
              กรุณาเลือกก่อนบันทึก ระบบจะไม่เลือกแทนนาย
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <Field label="ชื่อบัตร" htmlFor="name">
        <Input
          id="name"
          name="name"
          defaultValue={card?.name}
          placeholder="เช่น KBank Platinum"
          required
        />
      </Field>
      {!card ? (
        <Field label="สกุลเงิน" htmlFor="currency">
          <Input
            id="currency"
            name="currency"
            defaultValue="THB"
            maxLength={3}
            required
          />
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="ผู้ออกบัตร" htmlFor="issuer">
          <Input
            id="issuer"
            name="issuer"
            defaultValue={card?.issuer ?? ""}
            placeholder="เช่น KBank"
          />
        </Field>
        <Field label="เครือข่าย" htmlFor="network">
          <Input
            id="network"
            name="network"
            defaultValue={card?.network ?? ""}
            placeholder="Visa / Mastercard"
          />
        </Field>
      </div>
      <Field label="เลขท้ายบัตร 4 หลัก" htmlFor="lastFour">
        <Input
          id="lastFour"
          name="lastFour"
          inputMode="numeric"
          maxLength={4}
          defaultValue={card?.lastFour ?? ""}
          placeholder="1234"
        />
      </Field>
      <Field label="วงเงิน" htmlFor="creditLimit">
        <Input
          id="creditLimit"
          name="creditLimit"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={card?.creditLimit}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="วันตัดรอบ" htmlFor="statementClosingDay">
          <Input
            id="statementClosingDay"
            name="statementClosingDay"
            type="number"
            min={1}
            max={31}
            defaultValue={card?.statementClosingDay ?? 1}
            required
          />
        </Field>
        <Field label="วันครบกำหนด" htmlFor="paymentDueDay">
          <Input
            id="paymentDueDay"
            name="paymentDueDay"
            type="number"
            min={1}
            max={31}
            defaultValue={card?.paymentDueDay ?? 15}
            required
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-finance-muted">
        ถ้าเดือนไหนไม่มีวันที่เลือก ระบบจะใช้วันสุดท้ายของเดือน
      </p>
      <Field label="APR ต่อปี (%) — ใช้แสดงข้อมูลเท่านั้น" htmlFor="apr">
        <Input
          id="apr"
          name="apr"
          type="number"
          min="0"
          step="0.0001"
          defaultValue={card?.apr ?? ""}
        />
      </Field>
      {!card ? (
        <p className="rounded-control bg-finance-primary-soft p-3 text-sm text-finance-muted">
          บัตรใหม่เริ่มที่ยอด 0 บาท จากนั้นบันทึกการซื้อและจ่ายบัตรได้จากหน้ารายละเอียดบัตร
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="sticky bottom-3 z-10">
        <SubmitButton size="lg" disabled={!card && !scope}>
          {card ? "บันทึกข้อมูลบัตร" : "สร้างบัตรเครดิต"}
        </SubmitButton>
      </div>
    </form>
  );
}
