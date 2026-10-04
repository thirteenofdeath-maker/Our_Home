"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { deleteChoreTemplateAction } from "../actions";

export function DeleteChoreTemplateButton({
  templateId,
  title,
}: {
  templateId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    deleteChoreTemplateAction,
    initialActionState,
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-[0.75rem] px-3 py-2 text-left text-danger"
      >
        ลบตาราง
      </button>
    );
  }

  return (
    <form action={action} className="flex min-w-64 flex-col gap-2 p-2">
      <input type="hidden" name="templateId" value={templateId} />
      <p className="text-sm text-finance-text">
        ลบ “{title}” พร้อมงานและประวัติทั้งหมดหรือไม่?
      </p>
      <div className="flex gap-2">
        <SubmitButton size="md" className="bg-danger text-danger-foreground">
          ยืนยันลบ
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          size="md"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          ยกเลิก
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
