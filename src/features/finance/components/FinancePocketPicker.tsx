"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import type { TransferEndpoint } from "@/features/transactions/domain/unified-transfer";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/money";

type WalletOptionSource = { id: string; name: string };
type PocketOptionSource = {
  id: string;
  name: string;
  currency: string;
  balance: string;
};

type EmptyChoice = {
  label: string;
  description?: string;
};

export function buildFinancePocketOptions(
  wallets: WalletOptionSource[],
  pocketsByWallet: Record<string, PocketOptionSource[]>,
): TransferEndpoint[] {
  return wallets.flatMap((wallet) =>
    (pocketsByWallet[wallet.id] ?? []).map((pocket) => ({
      walletId: wallet.id,
      walletName: wallet.name,
      pocketId: pocket.id,
      pocketName: pocket.name,
      currency: pocket.currency,
      balance: pocket.balance,
    })),
  );
}

export function FinancePocketPickerSheet({
  open,
  onClose,
  title = "เลือกกระเป๋าเงิน",
  options,
  selectedPocketId,
  onSelect,
  emptyChoice,
  onSelectEmpty,
  isOptionDisabled,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  options: TransferEndpoint[];
  selectedPocketId?: string | null;
  onSelect: (option: TransferEndpoint) => void;
  emptyChoice?: EmptyChoice;
  onSelectEmpty?: () => void;
  isOptionDisabled?: (option: TransferEndpoint) => boolean;
}) {
  const walletGroups = options.reduce<TransferEndpoint[][]>(
    (groups, option) => {
      const group = groups.find(
        (items) => items[0]?.walletId === option.walletId,
      );
      if (group) group.push(option);
      else groups.push([option]);
      return groups;
    },
    [],
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={title} tone="finance">
      <div className="flex flex-col gap-4">
        {emptyChoice ? (
          <button
            type="button"
            onClick={() => {
              onSelectEmpty?.();
              onClose();
            }}
            className={cn(
              "flex min-h-16 w-full items-center rounded-2xl px-3 py-2 text-left",
              selectedPocketId
                ? "bg-finance-surface-strong"
                : "bg-finance-primary-soft",
            )}
          >
            <span>
              <span className="block font-medium text-finance-text">
                {emptyChoice.label}
              </span>
              {emptyChoice.description ? (
                <span className="text-xs text-finance-muted">
                  {emptyChoice.description}
                </span>
              ) : null}
            </span>
          </button>
        ) : null}

        {walletGroups.map((group) => (
          <section key={group[0].walletId}>
            <h3 className="mb-1 text-sm font-semibold text-finance-text">
              {group[0].walletName}
            </h3>
            <div className="flex flex-col gap-1">
              {group.map((option) => {
                const disabled = isOptionDisabled?.(option) ?? false;
                return (
                  <button
                    key={option.pocketId}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSelect(option);
                      onClose();
                    }}
                    className={cn(
                      "flex min-h-16 w-full items-center justify-between rounded-2xl px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40",
                      option.pocketId === selectedPocketId
                        ? "bg-finance-primary-soft"
                        : "bg-finance-surface-strong",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-finance-text">
                        {option.pocketName}
                      </span>
                      <span className="block truncate text-xs text-finance-muted">
                        {option.walletName} · {option.currency}
                      </span>
                    </span>
                    <span className="ml-3 shrink-0 tabular-nums text-finance-text">
                      {formatCurrency(option.balance, option.currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}

export function FinancePocketField({
  label = "กระเป๋าเงิน",
  title = "เลือกกระเป๋าเงิน",
  options,
  selectedPocketId,
  onSelect,
  walletInputName = "walletId",
  pocketInputName = "pocketId",
  placeholder = "เลือกกระเป๋าเงิน",
  emptyChoice,
  onSelectEmpty,
  disabled = false,
}: {
  label?: string;
  title?: string;
  options: TransferEndpoint[];
  selectedPocketId?: string | null;
  onSelect: (option: TransferEndpoint) => void;
  walletInputName?: string | null;
  pocketInputName?: string | null;
  placeholder?: string;
  emptyChoice?: EmptyChoice;
  onSelectEmpty?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    options.find((option) => option.pocketId === selectedPocketId) ?? null;

  return (
    <>
      {walletInputName ? (
        <input
          type="hidden"
          name={walletInputName}
          value={selected?.walletId ?? ""}
        />
      ) : null}
      {pocketInputName ? (
        <input
          type="hidden"
          name={pocketInputName}
          value={selected?.pocketId ?? ""}
        />
      ) : null}
      <div>
        <p className="mb-1 text-sm font-medium text-finance-muted">{label}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex min-h-[88px] w-full flex-col justify-center rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong p-3 text-left shadow-sm disabled:opacity-50"
        >
          <span className="truncate text-xs text-finance-muted">
            {selected?.walletName ?? emptyChoice?.description ?? placeholder}
          </span>
          <span className="truncate text-sm font-semibold text-finance-text">
            {selected?.pocketName ?? emptyChoice?.label ?? "เลือก Pocket"}
          </span>
          {selected ? (
            <span className="mt-1 text-xs tabular-nums text-finance-muted">
              {formatCurrency(selected.balance, selected.currency)}
            </span>
          ) : null}
        </button>
      </div>
      <FinancePocketPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        options={options}
        selectedPocketId={selectedPocketId}
        onSelect={onSelect}
        emptyChoice={emptyChoice}
        onSelectEmpty={onSelectEmpty}
      />
    </>
  );
}
