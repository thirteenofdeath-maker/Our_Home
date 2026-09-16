"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import {
  buildFinancePocketOptions,
  FinancePocketField,
} from "@/features/finance/components/FinancePocketPicker";
import type { PocketWithBalance } from "@/features/pockets/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";

import {
  createDebtAction,
  recordAdditionalDebtPrincipalAction,
  recordDebtPaymentAction,
} from "../actions";

type CashProps = {
  debtId: string;
  wallets: Wallet[];
  pockets: Record<string, PocketWithBalance[]>;
};

function firstPocketId(
  wallets: Wallet[],
  pockets: Record<string, PocketWithBalance[]>,
): string {
  return wallets.flatMap((wallet) => pockets[wallet.id] ?? [])[0]?.id ?? "";
}

function CashFields({
  wallets,
  pockets,
  selectedPocketId,
  onSelectPocket,
}: {
  wallets: Wallet[];
  pockets: Record<string, PocketWithBalance[]>;
  selectedPocketId: string;
  onSelectPocket: (pocketId: string) => void;
}) {
  const options = buildFinancePocketOptions(wallets, pockets);
  return (
    <FinancePocketField
      options={options}
      selectedPocketId={selectedPocketId}
      onSelect={(option) => onSelectPocket(option.pocketId)}
    />
  );
}

export function DebtCreateForm({
  wallets,
  pockets,
  hasHousehold,
  variant = "page",
}: {
  wallets: Wallet[];
  pockets: Record<string, PocketWithBalance[]>;
  hasHousehold: boolean;
  variant?: "page" | "sheet";
}) {
  void variant;
  const [state, action] = useActionState(createDebtAction, initialActionState);
  const [scope, setScope] = useState<"PERSONAL" | "HOUSEHOLD">("PERSONAL");
  const scopedWallets = wallets.filter((wallet) => wallet.scope === scope);
  const [pocketId, setPocketId] = useState(() =>
    firstPocketId(scopedWallets, pockets),
  );

  return (
    <form action={action} className="finance-ui-tone flex flex-col gap-3">
      <Field label="ขอบเขต" htmlFor="scope">
        <Select
          id="scope"
          name="scope"
          value={scope}
          onChange={(event) => {
            const nextScope = event.target.value as typeof scope;
            const nextWallets = wallets.filter(
              (wallet) => wallet.scope === nextScope,
            );
            setScope(nextScope);
            setPocketId(firstPocketId(nextWallets, pockets));
          }}
        >
          <option value="PERSONAL">ส่วนตัว</option>
          {hasHousehold ? <option value="HOUSEHOLD">ครอบครัว</option> : null}
        </Select>
      </Field>
      <Field label="ประเภท" htmlFor="debtType">
        <Select id="debtType" name="debtType">
          <option value="LIABILITY">เงินที่เรายืม</option>
          <option value="RECEIVABLE">เงินที่เราให้ยืม</option>
        </Select>
      </Field>
      <Field label="ชื่อ" htmlFor="name">
        <Input id="name" name="name" required />
      </Field>
      <Field label="คู่สัญญา" htmlFor="counterparty">
        <Input id="counterparty" name="counterparty" />
      </Field>
      <Field label="เงินต้น" htmlFor="principal">
        <Input id="principal" name="principal" required />
      </Field>
      <Field label="สกุลเงิน" htmlFor="currency">
        <Input id="currency" name="currency" defaultValue="THB" required />
      </Field>
      <CashFields
        wallets={scopedWallets}
        pockets={pockets}
        selectedPocketId={pocketId}
        onSelectPocket={setPocketId}
      />
      {state.error ? <p className="text-danger">{state.error}</p> : null}
      <SubmitButton>บันทึก</SubmitButton>
    </form>
  );
}

export function DebtPaymentForm({
  debtId,
  wallets,
  pockets,
  categories,
  transactionType,
}: CashProps & {
  categories: CategoryNode[];
  transactionType: "INCOME" | "EXPENSE";
}) {
  const [state, action] = useActionState(
    recordDebtPaymentAction,
    initialActionState,
  );
  const [pocketId, setPocketId] = useState(() =>
    firstPocketId(wallets, pockets),
  );
  const options = buildFinancePocketOptions(wallets, pockets);
  const selectedWalletId = options.find(
    (option) => option.pocketId === pocketId,
  )?.walletId;

  return (
    <form action={action} className="finance-ui-tone flex flex-col gap-3">
      <input type="hidden" name="debtId" value={debtId} />
      <Field label="เงินต้น" htmlFor="principal">
        <Input id="principal" name="principal" required />
      </Field>
      <Field label="ดอกเบี้ย/ค่าธรรมเนียม" htmlFor="interest">
        <Input id="interest" name="interest" defaultValue="0.00" required />
      </Field>
      <CashFields
        wallets={wallets}
        pockets={pockets}
        selectedPocketId={pocketId}
        onSelectPocket={setPocketId}
      />
      <Field label="หมวดดอกเบี้ย" htmlFor="categoryId">
        <CategoryPicker
          name="categoryId"
          categories={categories}
          transactionType={transactionType}
          walletId={selectedWalletId}
        />
      </Field>
      {state.error ? <p className="text-danger">{state.error}</p> : null}
      <SubmitButton>บันทึกการชำระ</SubmitButton>
    </form>
  );
}

export function AdditionalDebtPrincipalForm({
  debtId,
  wallets,
  pockets,
}: CashProps) {
  const [state, action] = useActionState(
    recordAdditionalDebtPrincipalAction,
    initialActionState,
  );
  const [pocketId, setPocketId] = useState(() =>
    firstPocketId(wallets, pockets),
  );

  return (
    <form action={action} className="finance-ui-tone flex flex-col gap-3">
      <input type="hidden" name="debtId" value={debtId} />
      <Field label="เงินต้นเพิ่ม" htmlFor="principal">
        <Input id="principal" name="principal" required />
      </Field>
      <CashFields
        wallets={wallets}
        pockets={pockets}
        selectedPocketId={pocketId}
        onSelectPocket={setPocketId}
      />
      {state.error ? <p className="text-danger">{state.error}</p> : null}
      <SubmitButton>บันทึกเงินต้นเพิ่ม</SubmitButton>
    </form>
  );
}
