"use client";

import { Field, Select } from "@/components/ui/Field";

export interface FundingWalletOption {
  id: string;
  name: string;
  currency: string;
}

/**
 * The combined funding-source selector shown once "ครอบครัว" is chosen in
 * ExpenseScopeSelect (Phase U / 0051): every eligible household wallet
 * PLUS the current payer's own eligible personal wallets, in one list —
 * per spec, every row carries an explicit TEXT badge (never color alone),
 * so this stays a plain accessible `<select>` rather than a custom
 * dropdown. Only the current payer's own personal wallets are ever passed
 * in here (never another member's — nothing here fetches or displays
 * another user's wallets or balances; the caller already filtered the
 * RLS-scoped wallet list down to `scope === "PERSONAL"`, which can only
 * ever be the caller's own rows).
 */
export function HouseholdExpenseFundingSelect({
  householdWallets,
  personalWallets,
  householdName,
  payerDisplayName,
  value,
  onChange,
  disabled,
}: {
  householdWallets: FundingWalletOption[];
  personalWallets: FundingWalletOption[];
  householdName: string;
  payerDisplayName: string;
  value: string;
  onChange: (walletId: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label="จ่ายจากกระเป๋าเงิน" htmlFor="household-expense-funding-select">
      <Select
        id="household-expense-funding-select"
        name="walletId"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        required
      >
        <option value="" disabled>
          เลือกกระเป๋าเงิน
        </option>
        {householdWallets.length > 0 ? (
          <optgroup label="ครอบครัว">
            {householdWallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                ครอบครัว · {householdName} · {wallet.name} ({wallet.currency})
              </option>
            ))}
          </optgroup>
        ) : null}
        {personalWallets.length > 0 ? (
          <optgroup label="ส่วนตัว">
            {personalWallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                ส่วนตัว · {payerDisplayName} · {wallet.name} ({wallet.currency})
              </option>
            ))}
          </optgroup>
        ) : null}
      </Select>
    </Field>
  );
}
