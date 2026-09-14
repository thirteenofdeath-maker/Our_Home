"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { renamePocketAction } from "../actions";

export function RenamePocketForm({
  pocketId,
  walletId,
  currentName,
  currentBalance,
  currentType,
}: {
  pocketId: string;
  walletId: string;
  currentName: string;
  currentBalance: string;
  currentType: "BANK" | "CASH" | "CREDIT_CARD" | "E_WALLET" | "OTHER";
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(
    renamePocketAction,
    initialActionState,
  );

  if (!editing) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-auto px-3"
        aria-expanded={false}
        onClick={() => setEditing(true)}
      >
        แก้ไข
      </Button>
    );
  }

  return (
    <PocketRenameEditor
      pocketId={pocketId}
      walletId={walletId}
      currentName={currentName}
      currentBalance={currentBalance}
      currentType={currentType}
      error={state.error}
      formAction={formAction}
      onCancel={() => setEditing(false)}
    />
  );
}

export function PocketRenameEditor({
  pocketId,
  walletId,
  currentName,
  currentBalance,
  currentType,
  error,
  formAction,
  onCancel,
}: {
  pocketId: string;
  walletId: string;
  currentName: string;
  currentBalance: string;
  currentType: "BANK" | "CASH" | "CREDIT_CARD" | "E_WALLET" | "OTHER";
  error?: string;
  formAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={formAction} className="grid w-full grid-cols-1 gap-3 pt-3">
      <input type="hidden" name="pocketId" value={pocketId} />
      <input type="hidden" name="walletId" value={walletId} />
      <Field label="ชื่อ Pocket" htmlFor={`pocket-name-${pocketId}`}>
        <Input
          id={`pocket-name-${pocketId}`}
          name="name"
          defaultValue={currentName}
          autoFocus
          required
        />
      </Field>
      <Field label="ยอดเงิน" htmlFor={`pocket-balance-${pocketId}`}>
        <Input
          id={`pocket-balance-${pocketId}`}
          name="balance"
          type="text"
          inputMode="decimal"
          defaultValue={currentBalance}
          required
        />
      </Field>
      <Field label="ประเภท Pocket" htmlFor={`pocket-type-${pocketId}`}>
        <Select
          id={`pocket-type-${pocketId}`}
          name="pocketType"
          defaultValue={currentType}
          disabled={currentType === "CREDIT_CARD"}
        >
          {currentType === "CREDIT_CARD" ? (
            <option value="CREDIT_CARD">บัตรเครดิต</option>
          ) : (
            <>
              <option value="BANK">บัญชีธนาคาร</option>
              <option value="CASH">เงินสด</option>
              <option value="E_WALLET">E-Wallet</option>
              <option value="OTHER">อื่น ๆ</option>
            </>
          )}
        </Select>
      </Field>
      {currentType === "CREDIT_CARD" ? (
        <input type="hidden" name="pocketType" value="CREDIT_CARD" />
      ) : null}
      <div className="flex gap-2">
        <SubmitButton size="md" className="w-auto px-4 text-xs">
          บันทึก
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          size="md"
          className="w-auto px-3"
          onClick={onCancel}
        >
          ยกเลิก
        </Button>
      </div>
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
    </form>
  );
}
