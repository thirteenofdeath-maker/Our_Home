"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Pocket } from "@/features/pockets/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

import { createCreditCardCashAdvanceAction } from "../actions";
import type { CreditCardAccount } from "../types";

export function CreditCardCashAdvanceForm({
  card,
  wallets,
  pocketsByWallet,
}: {
  card: CreditCardAccount;
  wallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
}) {
  const [state, action] = useActionState(createCreditCardCashAdvanceAction, initialActionState);
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const pockets = useMemo(() => pocketsByWallet[walletId] ?? [], [pocketsByWallet, walletId]);
  const today = new Date().toLocaleDateString("en-CA");
  const canSubmit = Boolean(walletId && pockets.length && Number(card.availableCredit) > 0);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
      <input type="hidden" name="cardAccountId" value={card.accountId} />
      <div className="rounded-control bg-finance-primary-soft p-3 text-sm text-finance-muted">
        <p>วงเงินใช้ได้ {formatCurrency(card.availableCredit, card.currency)}</p>
        <p className="mt-1 text-xs">เงินย้ายจากบัตรเข้า Wallet ปลายทาง รายการนี้ไม่ใช่รายรับหรือรายจ่าย ค่าธรรมเนียมบันทึกแยกตามยอดที่ผู้ออกบัตรเรียกเก็บจริง</p>
      </div>
      {wallets.length ? (
        <>
          <Field label="Wallet ปลายทาง" htmlFor="toWalletId">
            <Select id="toWalletId" name="toWalletId" value={walletId} onChange={(event) => setWalletId(event.currentTarget.value)}>
              {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency}</option>)}
            </Select>
          </Field>
          <Field label="Pocket ปลายทาง" htmlFor="toPocketId">
            <Select key={walletId} id="toPocketId" name="toPocketId" defaultValue={pockets[0]?.id ?? ""} required>
              {pockets.map((pocket) => <option key={pocket.id} value={pocket.id}>{pocket.name}</option>)}
            </Select>
          </Field>
        </>
      ) : (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          ยังไม่มี Wallet ปลายทางสกุล {card.currency} ที่ใช้รับเงินได้
        </p>
      )}
      <Field label={`จำนวนเงิน (${card.currency})`} htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" min="0.01" step="0.01" max={card.availableCredit} required autoFocus />
      </Field>
      <Field label="วันที่กดเงินสด" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>
      <Field label="ชื่อรายการ" htmlFor="title"><Input id="title" name="title" placeholder="เช่น กดเงินสดฉุกเฉิน" /></Field>
      <Field label="โน้ต" htmlFor="note"><Input id="note" name="note" /></Field>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <div className="sticky bottom-3 z-10">
        <SubmitButton size="lg" variant="financeTransfer" disabled={!canSubmit}>บันทึกการกดเงินสด</SubmitButton>
      </div>
    </form>
  );
}
