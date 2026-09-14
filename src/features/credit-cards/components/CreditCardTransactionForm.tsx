"use client";

import { useActionState, useMemo, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/money";

import { createCreditCardTransactionAction } from "../actions";
import type {
  CreditCardAccountOption,
  CreditCardEndpoint,
  CreditCardMode,
  CreditCardSheetData,
} from "../types";

const MODES: Array<{ value: CreditCardMode; label: string }> = [
  { value: "PAYMENT", label: "จ่ายบัตรเครดิต" },
  { value: "CASHBACK", label: "รับ Cashback" },
  { value: "CASH_ADVANCE", label: "กดเงินสด" },
];

export function CreditCardTransactionForm({
  cards,
  endpoints,
}: CreditCardSheetData) {
  const [mode, setMode] = useState<CreditCardMode>("PAYMENT");
  const [cardId, setCardId] = useState(cards[0]?.accountId ?? "");
  const [endpointId, setEndpointId] = useState("");
  const [state, action] = useActionState(
    createCreditCardTransactionAction,
    initialActionState,
  );
  const card = cards.find((item) => item.accountId === cardId) ?? cards[0];
  const compatibleEndpoints = useMemo(
    () =>
      card
        ? endpoints.filter((endpoint) => endpoint.currency === card.currency)
        : [],
    [card, endpoints],
  );
  const endpoint =
    compatibleEndpoints.find((item) => item.pocketId === endpointId) ?? null;
  const today = new Date().toLocaleDateString("en-CA");

  function changeCard(nextCardId: string) {
    const nextCard = cards.find((item) => item.accountId === nextCardId);
    setCardId(nextCardId);
    if (!nextCard || endpoint?.currency !== nextCard.currency)
      setEndpointId("");
  }

  if (!card) {
    return (
      <div className="rounded-[1.15rem] bg-finance-primary-soft/70 p-5 text-center">
        <p className="font-medium text-finance-text">
          ยังไม่มี Pocket บัตรเครดิต
        </p>
        <p className="mt-1 text-sm text-finance-muted">
          เพิ่มบัตรเครดิตใน Wallet ก่อนบันทึกรายการ
        </p>
      </div>
    );
  }

  const info =
    mode === "PAYMENT"
      ? "การจ่ายบัตรเครดิตจะลดเงินใน Pocket ต้นทาง ลดหนี้บัตร และเพิ่มวงเงินคงเหลือ"
      : mode === "CASHBACK"
        ? "Cashback จะปรับเฉพาะยอดบัตรเครดิต และไม่ถูกนับรวมเป็นรายรับ รายจ่าย หรือโอนเงิน"
        : "การกดเงินสดจะเพิ่มยอดหนี้บัตรและเพิ่มเงินใน Pocket ปลายทาง โดยไม่ถูกนับเป็นรายรับหรือรายจ่าย";
  const submitLabel =
    mode === "PAYMENT"
      ? "จ่ายบัตรเครดิต"
      : mode === "CASHBACK"
        ? "บันทึก Cashback"
        : "บันทึกกดเงินสด";

  return (
    <form action={action} className="finance-ui-tone flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="cardAccountId" value={card.accountId} />
      <input
        type="hidden"
        name="endpointWalletId"
        value={endpoint?.walletId ?? ""}
      />
      <input
        type="hidden"
        name="endpointPocketId"
        value={endpoint?.pocketId ?? ""}
      />

      <div className="grid grid-cols-3 rounded-[1.1rem] bg-finance-surface-strong p-1 shadow-sm">
        {MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setMode(item.value);
              setEndpointId("");
            }}
            className={cn(
              "min-h-12 rounded-[0.9rem] px-2 text-[13px] font-medium transition-colors",
              mode === item.value
                ? "bg-finance-primary-soft text-finance-primary-strong"
                : "text-finance-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === "CASHBACK" ? (
        <AccountSelect
          label="เข้าบัตรเครดิต"
          value={card.accountId}
          onChange={changeCard}
          cards={cards}
        />
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          {mode === "PAYMENT" ? (
            <EndpointSelect
              label="จาก Pocket"
              value={endpointId}
              onChange={setEndpointId}
              endpoints={compatibleEndpoints}
            />
          ) : (
            <AccountSelect
              label="จากบัตรเครดิต"
              value={card.accountId}
              onChange={changeCard}
              cards={cards}
            />
          )}
          <span
            aria-hidden="true"
            className="self-center pt-6 text-xl text-finance-transfer"
          >
            →
          </span>
          {mode === "PAYMENT" ? (
            <AccountSelect
              label="เข้าบัตรเครดิต"
              value={card.accountId}
              onChange={changeCard}
              cards={cards}
            />
          ) : (
            <EndpointSelect
              label="เข้า Pocket"
              value={endpointId}
              onChange={setEndpointId}
              endpoints={compatibleEndpoints}
            />
          )}
        </div>
      )}

      <div className="flex gap-2 rounded-[1rem] bg-finance-surface-strong p-3 text-sm text-finance-muted shadow-sm">
        <AppIcon
          name="info"
          className="mt-0.5 size-5 shrink-0 text-finance-transfer"
        />
        <p>{info}</p>
      </div>

      <div>
        <label
          htmlFor="credit-card-amount"
          className="text-sm font-medium text-finance-muted"
        >
          จำนวนเงิน
        </label>
        <div className="mt-1.5 flex h-16 items-center rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong px-3 shadow-sm focus-within:border-finance-primary focus-within:ring-3 focus-within:ring-finance-primary-soft">
          <span className="text-2xl font-semibold text-finance-text">
            {card.currency === "THB" ? "฿" : card.currency}
          </span>
          <input
            id="credit-card-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]{1,2})?"
            placeholder="0.00"
            autoFocus
            required
            className="h-14 min-w-0 flex-1 border-0 bg-transparent px-3 text-right text-3xl font-semibold tabular-nums text-finance-text outline-none placeholder:text-finance-muted"
          />
        </div>
        <p className="mt-1 text-right text-xs text-finance-muted">
          {mode === "PAYMENT"
            ? `ยอดหนี้ ${formatCurrency(card.liability, card.currency)}`
            : `วงเงินคงเหลือ ${formatCurrency(card.availableCredit, card.currency)}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-finance-text">
          วันที่
          <Input name="occurredAt" type="date" defaultValue={today} required />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-finance-text">
          หมายเหตุ
          <Input
            name="note"
            type="text"
            placeholder={mode === "CASHBACK" ? "Cashback" : "เพิ่มหมายเหตุ"}
          />
        </label>
      </div>

      {mode !== "CASHBACK" && !endpoint ? (
        <p className="text-sm text-finance-muted">
          เลือก Pocket สกุล {card.currency}
        </p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-finance-expense">{state.error}</p>
      ) : null}
      <SubmitButton
        size="lg"
        variant="financeTransfer"
        disabled={mode !== "CASHBACK" && !endpoint}
      >
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

function AccountSelect({
  label,
  value,
  onChange,
  cards,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  cards: CreditCardAccountOption[];
}) {
  return (
    <label className="min-w-0 text-xs font-medium text-finance-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-[76px] w-full rounded-[1.2rem] border border-finance-primary-soft bg-finance-surface-strong px-3 text-sm font-semibold text-finance-text shadow-sm outline-none"
      >
        {cards.map((card) => (
          <option key={card.accountId} value={card.accountId}>
            {card.name} · {formatCurrency(card.availableCredit, card.currency)}
          </option>
        ))}
      </select>
    </label>
  );
}

function EndpointSelect({
  label,
  value,
  onChange,
  endpoints,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  endpoints: CreditCardEndpoint[];
}) {
  return (
    <label className="min-w-0 text-xs font-medium text-finance-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="mt-1 h-[76px] w-full rounded-[1.2rem] border border-finance-primary-soft bg-finance-surface-strong px-3 text-sm font-semibold text-finance-text shadow-sm outline-none"
      >
        <option value="">เลือก Pocket</option>
        {endpoints.map((endpoint) => (
          <option key={endpoint.pocketId} value={endpoint.pocketId}>
            {endpoint.pocketName} ·{" "}
            {formatCurrency(endpoint.balance, endpoint.currency)}
          </option>
        ))}
      </select>
    </label>
  );
}
