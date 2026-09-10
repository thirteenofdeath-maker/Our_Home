"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { renamePocketAction } from "../actions";

export function RenamePocketForm({ pocketId, walletId, currentName }: { pocketId: string; walletId: string; currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(renamePocketAction, initialActionState);

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
        แก้ไขชื่อ
      </Button>
    );
  }

  return (
    <PocketRenameEditor
      pocketId={pocketId}
      walletId={walletId}
      currentName={currentName}
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
  error,
  formAction,
  onCancel,
}: {
  pocketId: string;
  walletId: string;
  currentName: string;
  error?: string;
  formAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="pocketId" value={pocketId} />
      <input type="hidden" name="walletId" value={walletId} />
      <Input aria-label="ชื่อ Pocket" name="name" defaultValue={currentName} className="min-w-44 flex-1" autoFocus required />
      <SubmitButton size="md" className="w-auto px-3 text-xs">
        บันทึก
      </SubmitButton>
      <Button type="button" variant="ghost" size="md" className="w-auto px-3" onClick={onCancel}>
        ยกเลิก
      </Button>
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
    </form>
  );
}
