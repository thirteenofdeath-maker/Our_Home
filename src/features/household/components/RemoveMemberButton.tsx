"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { removeHouseholdMemberAction } from "../actions";

export function RemoveMemberButton({
  householdId,
  memberId,
  name,
}: {
  householdId: string;
  memberId: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    removeHouseholdMemberAction,
    initialActionState,
  );
  if (!confirming)
    return (
      <Button
        type="button"
        variant="ghost"
        size="md"
        className="text-danger"
        onClick={() => setConfirming(true)}
      >
        ลบออกจากครอบครัว
      </Button>
    );
  return (
    <form
      action={action}
      className="flex flex-col gap-2 rounded-xl bg-danger/5 p-3"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-sm">
        ลบ {name} ออกจากครอบครัว? บุคคลนี้จะเข้าถึงข้อมูลร่วมของบ้านไม่ได้อีก
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
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
