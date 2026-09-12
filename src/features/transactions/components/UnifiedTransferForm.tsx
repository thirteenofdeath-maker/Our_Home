"use client";

import { useActionState, useMemo, useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { createUnifiedTransferAction } from "@/features/transactions/actions";
import { isValidTransferAmount, isValidTransferDestination, reconcileTransferDestination, type TransferEndpoint } from "@/features/transactions/domain/unified-transfer";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

type Picker = "from" | "to" | null;

export function UnifiedTransferForm({ initialWalletId, endpoints, tags }: { initialWalletId: string; endpoints: TransferEndpoint[]; tags: TagOption[] }) {
  const initialFrom = endpoints.find((endpoint) => endpoint.walletId === initialWalletId) ?? endpoints[0] ?? null;
  const [from, setFrom] = useState<TransferEndpoint | null>(initialFrom);
  const [to, setTo] = useState<TransferEndpoint | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [amount, setAmount] = useState("");
  const [state, formAction] = useActionState(createUnifiedTransferAction, initialActionState);
  const today = new Date().toLocaleDateString("en-CA");
  const walletGroups = useMemo(
    () => endpoints.reduce<TransferEndpoint[][]>((groups, endpoint) => {
      const group = groups.find((items) => items[0]?.walletId === endpoint.walletId);
      if (group) group.push(endpoint);
      else groups.push([endpoint]);
      return groups;
    }, []),
    [endpoints],
  );

  function chooseFrom(endpoint: TransferEndpoint) {
    setFrom(endpoint);
    setTo((current) => reconcileTransferDestination(endpoint, current, endpoints));
    setPicker(null);
  }

  function chooseTo(endpoint: TransferEndpoint) {
    if (from && isValidTransferDestination(from, endpoint)) setTo(endpoint);
    setPicker(null);
  }

  if (!from) return <p className="py-8 text-center text-sm text-finance-muted">ยังไม่มีช่องเงินที่ใช้โอนได้</p>;

  return (
    <>
      <form action={formAction} className="finance-ui-tone flex flex-col gap-5">
        <input type="hidden" name="fromWalletId" value={from.walletId} />
        <input type="hidden" name="fromPocketId" value={from.pocketId} />
        <input type="hidden" name="toWalletId" value={to?.walletId ?? ""} />
        <input type="hidden" name="toPocketId" value={to?.pocketId ?? ""} />
        <input type="hidden" name="occurredAt" value={today} />

        <div className="text-center">
          <label htmlFor="unified-transfer-amount" className="text-xs font-medium text-finance-muted">จำนวนเงิน</label>
          <div className="mx-auto mt-1 flex max-w-xs items-center justify-center gap-2 border-b border-finance-border pb-2">
            <span className="text-3xl font-semibold text-finance-muted">{from.currency === "THB" ? "฿" : from.currency}</span>
            <Input id="unified-transfer-amount" name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" required className="h-auto border-0 bg-transparent p-0 text-center text-4xl font-semibold shadow-none" />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <EndpointButton label="จาก" endpoint={from} onClick={() => setPicker("from")} />
          <span aria-hidden className="pb-8 text-xl text-finance-transfer">→</span>
          <EndpointButton label="ไปยัง" endpoint={to} onClick={() => setPicker("to")} />
        </div>

        {!to ? <p className="text-sm text-finance-muted">เลือกปลายทาง</p> : null}
        <label className="flex flex-col gap-1 text-sm font-medium text-finance-text">
          หมายเหตุ
          <Input name="note" type="text" placeholder="เพิ่มหมายเหตุ (ถ้ามี)" />
        </label>
        <TagPicker name="tagIds" tags={tags} walletId={from.walletId} />
        {state.error ? <p className="text-sm text-finance-expense">{state.error}</p> : null}
        <SubmitButton size="lg" variant="financeTransfer" disabled={!to || !isValidTransferDestination(from, to) || !isValidTransferAmount(amount)}>โอนเงิน</SubmitButton>
      </form>

      <BottomSheet open={picker !== null} onClose={() => setPicker(null)} title={picker === "from" ? "เลือกต้นทาง" : "เลือกปลายทาง"} tone="finance">
        <div className="flex flex-col gap-4">
          {walletGroups.map((group) => (
            <section key={group[0].walletId}>
              <h3 className="mb-1 text-sm font-semibold text-finance-text">{group[0].walletName}</h3>
              <div className="flex flex-col gap-1">
                {group.map((endpoint) => {
                  const disabled = picker === "to" && !isValidTransferDestination(from, endpoint);
                  return <button key={endpoint.pocketId} type="button" disabled={disabled} onClick={() => picker === "from" ? chooseFrom(endpoint) : chooseTo(endpoint)} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-finance-background px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40"><span><span className="block font-medium text-finance-text">{endpoint.pocketName}</span><span className="text-xs text-finance-muted">{endpoint.walletName}</span></span><span className="tabular-nums text-finance-text">{formatCurrency(endpoint.balance, endpoint.currency)}</span></button>;
                })}
              </div>
            </section>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

function EndpointButton({ label, endpoint, onClick }: { label: string; endpoint: TransferEndpoint | null; onClick: () => void }) {
  return <div><p className="mb-1 text-xs text-finance-muted">{label}</p><button type="button" onClick={onClick} className="flex min-h-28 w-full flex-col justify-center rounded-2xl border border-finance-border bg-finance-surface p-3 text-left shadow-sm"><span className="truncate text-xs text-finance-muted">{endpoint?.walletName ?? "เลือกปลายทาง"}</span><span className="truncate font-semibold text-finance-text">{endpoint?.pocketName ?? "เลือกปลายทาง"}</span>{endpoint ? <span className="mt-2 text-xs tabular-nums text-finance-muted">{formatCurrency(endpoint.balance, endpoint.currency)}</span> : null}</button></div>;
}
