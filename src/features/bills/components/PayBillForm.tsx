"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import type { CategoryNode } from "@/features/categories/types";
import {
  buildFinancePocketOptions,
  FinancePocketField,
} from "@/features/finance/components/FinancePocketPicker";
import type { PocketWithBalance } from "@/features/pockets/types";
import type { TagOption } from "@/features/tags/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";

import { payBillAction } from "../actions";
import type { BillOccurrenceSummary } from "../types";

export function PayBillForm({
  item,
  wallets,
  pocketsByWallet,
  categories,
  tags,
}: {
  item: BillOccurrenceSummary;
  wallets: Wallet[];
  pocketsByWallet: Record<string, PocketWithBalance[]>;
  categories: CategoryNode[];
  tags: TagOption[];
}) {
  const [state, action] = useActionState(payBillAction, initialActionState);
  const validWallets = wallets.filter(
    (wallet) =>
      wallet.scope === item.scope && wallet.currency === item.currency,
  );
  const options = buildFinancePocketOptions(validWallets, pocketsByWallet);
  const initialPocketId =
    item.pocketId &&
    !item.pocketArchived &&
    options.some((option) => option.pocketId === item.pocketId)
      ? item.pocketId
      : (options[0]?.pocketId ?? "");
  const [pocketId, setPocketId] = useState(initialPocketId);
  const categoryOptions = categories.flatMap((category) => [
    category,
    ...category.children,
  ]);

  return (
    <form action={action} className="finance-ui-tone flex flex-col gap-4">
      <input type="hidden" name="occurrenceId" value={item.occurrenceId} />
      <Field label="จำนวนเงินจริง" htmlFor="amount">
        <Input
          id="amount"
          name="amount"
          defaultValue={item.expectedAmount}
          inputMode="decimal"
          required
        />
      </Field>
      <FinancePocketField
        options={options}
        selectedPocketId={pocketId}
        onSelect={(option) => setPocketId(option.pocketId)}
      />
      <Field label="หมวดหมู่" htmlFor="categoryId">
        <Select
          id="categoryId"
          name="categoryId"
          defaultValue={!item.categoryArchived ? item.categoryId : ""}
          required
        >
          <option value="" disabled>
            เลือกหมวดหมู่
          </option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="วันที่จ่าย" htmlFor="occurredAt">
        <Input
          id="occurredAt"
          name="occurredAt"
          type="date"
          defaultValue={bangkokDateKey()}
          required
        />
      </Field>
      <Field label="ชื่อรายการ" htmlFor="title">
        <Input id="title" name="title" defaultValue={item.title ?? item.name} />
      </Field>
      <Field label="โน้ต" htmlFor="note">
        <Input id="note" name="note" defaultValue={item.note ?? ""} />
      </Field>
      <div>
        {tags.map((tag) => (
          <label key={tag.id} className="mr-3 inline-flex gap-1">
            <input
              type="checkbox"
              name="tagIds"
              value={tag.id}
              defaultChecked={item.tags.some(
                (selected) =>
                  selected.id === tag.id && selected.archivedAt === null,
              )}
            />
            {tag.name}
          </label>
        ))}
      </div>
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton size="lg">ยืนยันจ่ายบิล</SubmitButton>
    </form>
  );
}
