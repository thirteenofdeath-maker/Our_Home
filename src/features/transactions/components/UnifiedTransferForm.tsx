"use client";

import { useActionState, useState } from "react";

import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FinancePocketPickerSheet } from "@/features/finance/components/FinancePocketPicker";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { createUnifiedTransferAction } from "@/features/transactions/actions";
import {
  isValidTransferAmount,
  isValidTransferDestination,
  reconcileTransferDestination,
  type TransferEndpoint,
} from "@/features/transactions/domain/unified-transfer";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

type Picker = "from" | "to" | null;

export function UnifiedTransferForm({
  initialWalletId,
  endpoints,
  tags,
}: {
  initialWalletId: string;
  endpoints: TransferEndpoint[];
  tags: TagOption[];
}) {
  const initialFrom =
    endpoints.find((endpoint) => endpoint.walletId === initialWalletId) ??
    endpoints[0] ??
    null;
  const [from, setFrom] = useState<TransferEndpoint | null>(initialFrom);
  const [to, setTo] = useState<TransferEndpoint | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [amount, setAmount] = useState("");
  const [state, formAction] = useActionState(
    createUnifiedTransferAction,
    initialActionState,
  );
  const today = new Date().toLocaleDateString("en-CA");

  function chooseFrom(endpoint: TransferEndpoint) {
    setFrom(endpoint);
    setTo((current) =>
      reconcileTransferDestination(endpoint, current, endpoints),
    );
    setPicker(null);
  }

  function chooseTo(endpoint: TransferEndpoint) {
    if (from && isValidTransferDestination(from, endpoint)) setTo(endpoint);
    setPicker(null);
  }

  if (!from)
    return (
      <p className="py-8 text-center text-sm text-finance-muted">
        ยังไม่มีช่องเงินที่ใช้โอนได้
      </p>
    );

  return (
    <>
      <form action={formAction} className="finance-ui-tone flex flex-col gap-4">
        <input type="hidden" name="fromWalletId" value={from.walletId} />
        <input type="hidden" name="fromPocketId" value={from.pocketId} />
        <input type="hidden" name="toWalletId" value={to?.walletId ?? ""} />
        <input type="hidden" name="toPocketId" value={to?.pocketId ?? ""} />

        <div>
          <label
            htmlFor="unified-transfer-amount"
            className="text-sm font-medium text-finance-muted"
          >
            จำนวนเงิน
          </label>
          <div className="mt-1.5 flex h-14 items-center rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong px-3 shadow-sm focus-within:border-finance-primary focus-within:ring-3 focus-within:ring-finance-primary-soft">
            <span className="text-2xl font-semibold text-finance-text">
              {from.currency === "THB" ? "฿" : from.currency}
            </span>
            <input
              id="unified-transfer-amount"
              name="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="text"
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              placeholder="0.00"
              required
              className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 text-3xl font-semibold text-finance-text outline-none placeholder:text-finance-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <EndpointButton
            label="จาก"
            endpoint={from}
            onClick={() => setPicker("from")}
          />
          <span
            aria-hidden
            className="self-center pt-5 text-xl text-finance-transfer"
          >
            →
          </span>
          <EndpointButton
            label="ไปยัง"
            endpoint={to}
            onClick={() => setPicker("to")}
          />
        </div>

        {!to ? (
          <p className="text-sm text-finance-muted">เลือกปลายทาง</p>
        ) : null}
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
              placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
            />
          </label>
        </div>
        <TagPicker name="tagIds" tags={tags} walletId={from.walletId} />
        {state.error ? (
          <p className="text-sm text-finance-expense">{state.error}</p>
        ) : null}
        <SubmitButton
          size="lg"
          variant="financeTransfer"
          disabled={
            !to ||
            !isValidTransferDestination(from, to) ||
            !isValidTransferAmount(amount)
          }
        >
          โอนเงิน
        </SubmitButton>
      </form>

      <FinancePocketPickerSheet
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === "from" ? "เลือกต้นทาง" : "เลือกปลายทาง"}
        options={endpoints}
        selectedPocketId={
          picker === "from" ? from.pocketId : (to?.pocketId ?? null)
        }
        onSelect={(endpoint) =>
          picker === "from" ? chooseFrom(endpoint) : chooseTo(endpoint)
        }
        isOptionDisabled={(endpoint) =>
          picker === "to" && !isValidTransferDestination(from, endpoint)
        }
      />
    </>
  );
}

function EndpointButton({
  label,
  endpoint,
  onClick,
}: {
  label: string;
  endpoint: TransferEndpoint | null;
  onClick: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-finance-muted">{label}</p>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[88px] w-full flex-col justify-center rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong p-3 text-left shadow-sm"
      >
        <span className="truncate text-xs text-finance-muted">
          {endpoint?.walletName ?? "เลือกปลายทาง"}
        </span>
        <span className="truncate text-sm font-semibold text-finance-text">
          {endpoint?.pocketName ?? "เลือกปลายทาง"}
        </span>
        {endpoint ? (
          <span className="mt-1 text-xs tabular-nums text-finance-muted">
            {formatCurrency(endpoint.balance, endpoint.currency)}
          </span>
        ) : null}
      </button>
    </div>
  );
}
