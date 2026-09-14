"use client";

import { useActionState, useMemo, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { BottomSheet } from "@/components/ui/BottomSheet";
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

type Picker = "card" | "endpoint" | null;

export function CreditCardTransactionForm({
  cards,
  endpoints,
}: CreditCardSheetData) {
  const [mode, setMode] = useState<CreditCardMode>("PAYMENT");
  const [cardId, setCardId] = useState(cards[0]?.accountId ?? "");
  const [endpointId, setEndpointId] = useState("");
  const [picker, setPicker] = useState<Picker>(null);
  const [amount, setAmount] = useState("");
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
  const endpointGroups = useMemo(
    () =>
      compatibleEndpoints.reduce<CreditCardEndpoint[][]>((groups, item) => {
        const group = groups.find(
          (items) => items[0]?.walletId === item.walletId,
        );
        if (group) group.push(item);
        else groups.push([item]);
        return groups;
      }, []),
    [compatibleEndpoints],
  );
  const today = new Date().toLocaleDateString("en-CA");

  function changeCard(nextCard: CreditCardAccountOption) {
    setCardId(nextCard.accountId);
    if (endpoint?.currency !== nextCard.currency) setEndpointId("");
    setPicker(null);
  }

  function changeMode(nextMode: CreditCardMode) {
    setMode(nextMode);
    setEndpointId("");
    setPicker(null);
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
    <>
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
              onClick={() => changeMode(item.value)}
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

        <AmountField
          currency={card.currency}
          amount={amount}
          onChange={setAmount}
        />

        {mode === "CASHBACK" ? (
          <RouteButton
            label="เข้าบัตรเครดิต"
            card={card}
            onClick={() => setPicker("card")}
          />
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            {mode === "PAYMENT" ? (
              <RouteButton
                label="จาก"
                endpoint={endpoint}
                placeholder="เลือกต้นทาง"
                onClick={() => setPicker("endpoint")}
              />
            ) : (
              <RouteButton
                label="จาก"
                card={card}
                onClick={() => setPicker("card")}
              />
            )}
            <span
              aria-hidden="true"
              className="self-center pt-5 text-xl text-finance-transfer"
            >
              →
            </span>
            {mode === "PAYMENT" ? (
              <RouteButton
                label="ไปยัง"
                card={card}
                onClick={() => setPicker("card")}
              />
            ) : (
              <RouteButton
                label="ไปยัง"
                endpoint={endpoint}
                placeholder="เลือกปลายทาง"
                onClick={() => setPicker("endpoint")}
              />
            )}
          </div>
        )}

        {mode !== "CASHBACK" && !endpoint ? (
          <p className="text-sm text-finance-muted">
            เลือก {mode === "PAYMENT" ? "ต้นทาง" : "ปลายทาง"} สกุล{" "}
            {card.currency}
          </p>
        ) : null}

        <div className="flex gap-2 rounded-[1rem] bg-finance-surface-strong p-3 text-sm text-finance-muted shadow-sm">
          <AppIcon
            name="info"
            className="mt-0.5 size-5 shrink-0 text-finance-transfer"
          />
          <p>{info}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-finance-text">
            วันที่
            <Input
              name="occurredAt"
              type="date"
              defaultValue={today}
              required
            />
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

        {state.error ? (
          <p className="text-sm text-finance-expense">{state.error}</p>
        ) : null}
        <SubmitButton
          size="lg"
          variant="financeTransfer"
          disabled={
            !amount || Number(amount) <= 0 || (mode !== "CASHBACK" && !endpoint)
          }
        >
          {submitLabel}
        </SubmitButton>
      </form>

      <BottomSheet
        open={picker === "card"}
        onClose={() => setPicker(null)}
        title="เลือกบัตรเครดิต"
        tone="finance"
        closeLabel="ย้อนกลับ"
      >
        <div className="flex flex-col gap-1">
          {cards.map((item) => (
            <button
              key={item.accountId}
              type="button"
              onClick={() => changeCard(item)}
              className={cn(
                "flex min-h-16 w-full items-center justify-between rounded-2xl px-3 py-2 text-left",
                item.accountId === card.accountId
                  ? "bg-finance-primary-soft"
                  : "bg-finance-surface-strong",
              )}
            >
              <span>
                <span className="block font-medium text-finance-text">
                  {item.name}
                </span>
                <span className="text-xs text-finance-muted">
                  วงเงินคงเหลือ
                </span>
              </span>
              <span className="tabular-nums text-finance-text">
                {formatCurrency(item.availableCredit, item.currency)}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={picker === "endpoint"}
        onClose={() => setPicker(null)}
        title={mode === "PAYMENT" ? "เลือกต้นทาง" : "เลือกปลายทาง"}
        tone="finance"
        closeLabel="ย้อนกลับ"
      >
        <div className="flex flex-col gap-4">
          {endpointGroups.map((group) => (
            <section key={group[0].walletId}>
              <h3 className="mb-1 text-sm font-semibold text-finance-text">
                {group[0].walletName}
              </h3>
              <div className="flex flex-col gap-1">
                {group.map((item) => (
                  <button
                    key={item.pocketId}
                    type="button"
                    onClick={() => {
                      setEndpointId(item.pocketId);
                      setPicker(null);
                    }}
                    className={cn(
                      "flex min-h-16 w-full items-center justify-between rounded-2xl px-3 py-2 text-left",
                      item.pocketId === endpoint?.pocketId
                        ? "bg-finance-primary-soft"
                        : "bg-finance-surface-strong",
                    )}
                  >
                    <span>
                      <span className="block font-medium text-finance-text">
                        {item.pocketName}
                      </span>
                      <span className="text-xs text-finance-muted">
                        {item.walletName}
                      </span>
                    </span>
                    <span className="tabular-nums text-finance-text">
                      {formatCurrency(item.balance, item.currency)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

function AmountField({
  currency,
  amount,
  onChange,
}: {
  currency: string;
  amount: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor="credit-card-amount"
        className="text-sm font-medium text-finance-muted"
      >
        จำนวนเงิน
      </label>
      <div className="mt-1.5 flex h-14 items-center rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong px-3 shadow-sm focus-within:border-finance-primary focus-within:ring-3 focus-within:ring-finance-primary-soft">
        <span className="text-2xl font-semibold text-finance-text">
          {currency === "THB" ? "฿" : currency}
        </span>
        <input
          id="credit-card-amount"
          name="amount"
          value={amount}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          inputMode="decimal"
          pattern="[0-9]+([.][0-9]{1,2})?"
          placeholder="0.00"
          autoFocus
          required
          className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 text-3xl font-semibold text-finance-text outline-none placeholder:text-finance-muted"
        />
      </div>
    </div>
  );
}

function RouteButton({
  label,
  card,
  endpoint,
  placeholder,
  onClick,
}: {
  label: string;
  card?: CreditCardAccountOption;
  endpoint?: CreditCardEndpoint | null;
  placeholder?: string;
  onClick: () => void;
}) {
  const title = card?.name ?? endpoint?.pocketName ?? placeholder ?? "เลือก";
  const subtitle = card
    ? "บัตรเครดิต"
    : (endpoint?.walletName ?? placeholder ?? "เลือก");
  const balance = card
    ? formatCurrency(card.availableCredit, card.currency)
    : endpoint
      ? formatCurrency(endpoint.balance, endpoint.currency)
      : null;

  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-medium text-finance-muted">{label}</p>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[88px] w-full flex-col justify-center rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong p-3 text-left shadow-sm"
      >
        <span className="truncate text-xs text-finance-muted">{subtitle}</span>
        <span className="truncate text-sm font-semibold text-finance-text">
          {title}
        </span>
        {balance ? (
          <span className="mt-1 text-xs tabular-nums text-finance-muted">
            {balance}
          </span>
        ) : null}
      </button>
    </div>
  );
}
