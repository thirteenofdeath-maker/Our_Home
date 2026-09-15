"use client";

import { useMemo, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import {
  FinanceOptionField,
  type FinanceOption,
} from "@/features/finance/components/FinanceOptionField";

type PocketOption = FinanceOption & { walletId: string };

export function FinanceExportForm({
  wallets,
  pockets,
  categories,
  tags,
}: {
  wallets: FinanceOption[];
  pockets: PocketOption[];
  categories: FinanceOption[];
  tags: FinanceOption[];
}) {
  const [walletId, setWalletId] = useState("");
  const [pocketId, setPocketId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [type, setType] = useState("");
  const visiblePockets = useMemo(
    () => pockets.filter((pocket) => pocket.walletId === walletId),
    [pockets, walletId],
  );

  return (
    <form action="/finance/export/download" method="get" className="flex flex-col gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Field label="จากวันที่" htmlFor="from">
          <Input id="from" type="date" name="from" />
        </Field>
        <Field label="ถึงวันที่" htmlFor="to">
          <Input id="to" type="date" name="to" />
        </Field>
      </div>

      <FinanceOptionField
        label="Wallet"
        title="เลือก Wallet"
        name="walletId"
        options={wallets}
        value={walletId}
        onChange={(nextWalletId) => {
          setWalletId(nextWalletId);
          setPocketId("");
        }}
        emptyChoice={{ label: "ทั้งหมด" }}
      />

      {walletId ? (
        <FinanceOptionField
          label="Pocket"
          title="เลือก Pocket"
          name="pocketId"
          options={visiblePockets}
          value={pocketId}
          onChange={setPocketId}
          emptyChoice={{ label: "ทั้งหมด" }}
        />
      ) : (
        <input type="hidden" name="pocketId" value="" />
      )}

      <FinanceOptionField
        label="หมวดหมู่"
        title="เลือกหมวดหมู่"
        name="categoryId"
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        emptyChoice={{ label: "ทั้งหมด" }}
      />

      <FinanceOptionField
        label="แท็ก"
        title="เลือกแท็ก"
        name="tagId"
        options={tags}
        value={tagId}
        onChange={setTagId}
        emptyChoice={{ label: "ทั้งหมด" }}
      />

      <FinanceOptionField
        label="ประเภท"
        title="เลือกประเภท"
        name="type"
        options={[
          { id: "INCOME", label: "รายรับ" },
          { id: "EXPENSE", label: "รายจ่าย" },
          { id: "TRANSFER", label: "โอนเงิน" },
          { id: "DEBT_PRINCIPAL", label: "เงินต้นหนี้" },
        ]}
        value={type}
        onChange={setType}
        emptyChoice={{ label: "ทั้งหมด" }}
      />

      <button
        className="min-h-11 rounded-control bg-primary text-primary-foreground"
        type="submit"
      >
        ดาวน์โหลด CSV
      </button>
    </form>
  );
}
