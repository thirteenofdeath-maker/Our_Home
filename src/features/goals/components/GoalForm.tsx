"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  buildFinancePocketOptions,
  FinancePocketField,
} from "@/features/finance/components/FinancePocketPicker";
import type { PocketWithBalance } from "@/features/pockets/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";

import { saveGoalAction } from "../actions";
import type { SavingGoalSummary } from "../types";

export function GoalForm({
  goal,
  wallets,
  pockets,
  hasHousehold,
  variant = "page",
}: {
  goal?: SavingGoalSummary;
  wallets: Wallet[];
  pockets: Record<string, PocketWithBalance[]>;
  hasHousehold: boolean;
  variant?: "page" | "sheet";
}) {
  void variant;
  const [state, action] = useActionState(saveGoalAction, initialActionState);
  const [scope, setScope] = useState<"PERSONAL" | "HOUSEHOLD">(
    goal?.scope ?? "PERSONAL",
  );
  const [linkedPocketId, setLinkedPocketId] = useState(
    goal?.linkedPocketId ?? "",
  );
  const options = useMemo(
    () =>
      buildFinancePocketOptions(
        wallets.filter((wallet) => wallet.scope === scope),
        pockets,
      ),
    [pockets, scope, wallets],
  );

  return (
    <form action={action} className="finance-ui-tone flex flex-col gap-4">
      {goal ? <input type="hidden" name="id" value={goal.goalId} /> : null}
      <Field label="ขอบเขต" htmlFor="scope">
        <Select
          id="scope"
          name="scope"
          value={scope}
          onChange={(event) => {
            setScope(event.target.value as typeof scope);
            setLinkedPocketId("");
          }}
          disabled={Boolean(goal)}
        >
          <option value="PERSONAL">ส่วนตัว</option>
          {hasHousehold ? <option value="HOUSEHOLD">ครอบครัว</option> : null}
        </Select>
        {goal ? <input type="hidden" name="scope" value={scope} /> : null}
      </Field>
      <Field label="ชื่อเป้าหมาย" htmlFor="name">
        <Input id="name" name="name" defaultValue={goal?.name ?? ""} required />
      </Field>
      <Field label="ยอดเป้าหมาย" htmlFor="targetAmount">
        <Input
          id="targetAmount"
          name="targetAmount"
          inputMode="decimal"
          defaultValue={goal?.targetAmount ?? ""}
          required
        />
      </Field>
      <FinancePocketField
        label="Pocket ที่เชื่อม"
        options={options}
        selectedPocketId={linkedPocketId}
        onSelect={(option) => setLinkedPocketId(option.pocketId)}
        walletInputName={null}
        pocketInputName="linkedPocketId"
      />
      <Field label="วันที่เป้าหมาย" htmlFor="targetDate">
        <Input
          id="targetDate"
          name="targetDate"
          type="date"
          defaultValue={goal?.targetDate ?? ""}
        />
      </Field>
      <Field label="โน้ต" htmlFor="note">
        <Input id="note" name="note" defaultValue={goal?.note ?? ""} />
      </Field>
      {state.error ? <p className="text-danger">{state.error}</p> : null}
      <SubmitButton>{goal ? "บันทึก" : "สร้างเป้าหมาย"}</SubmitButton>
    </form>
  );
}
