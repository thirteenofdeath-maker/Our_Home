"use client";

import { useActionState, useState } from "react";

import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { renameTagAction } from "../actions";

export function RenameTagForm({ id, currentName }: { id: string; currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(renameTagAction, initialActionState);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary">
        แก้ไขชื่อ
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Input name="name" defaultValue={currentName} className="h-9" autoFocus />
      <SubmitButton size="md" className="w-auto px-3 text-xs">
        บันทึก
      </SubmitButton>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-foreground-muted">
        ยกเลิก
      </button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
