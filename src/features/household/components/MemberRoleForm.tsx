"use client";

import { useActionState } from "react";

import { Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { changeMemberRoleAction } from "../actions";

export function MemberRoleForm({ householdId, memberId, role }: { householdId: string; memberId: string; role: "admin" | "member" }) {
  const [state, action] = useActionState(changeMemberRoleAction, initialActionState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="memberId" value={memberId} />
      <Select name="role" defaultValue={role} className="h-10">
        <option value="member">สมาชิก</option>
        <option value="admin">ผู้ดูแล</option>
      </Select>
      <SubmitButton size="md" className="w-auto">บันทึก</SubmitButton>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
