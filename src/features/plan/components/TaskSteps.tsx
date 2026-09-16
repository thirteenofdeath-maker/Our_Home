"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import {
  addPlanTaskStepAction,
  deletePlanTaskStepAction,
  togglePlanTaskStepAction,
} from "../actions";
import type { PlanTaskStep } from "../types";

export function TaskSteps({
  taskId,
  steps,
}: {
  taskId: string;
  steps: PlanTaskStep[];
}) {
  const [state, addAction] = useActionState(
    addPlanTaskStepAction,
    initialActionState,
  );
  return (
    <section className="finance-ui-tone rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-card">
      <h2 className="font-semibold text-finance-text">รายการย่อย</h2>
      <div className="mt-3 flex flex-col gap-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex min-w-0 items-center gap-2 border-b border-finance-primary-soft/70 py-2 last:border-0"
          >
            <form action={togglePlanTaskStepAction}>
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="stepId" value={step.id} />
              <input
                type="hidden"
                name="completed"
                value={String(!step.is_completed)}
              />
              <button
                type="submit"
                className="flex size-9 items-center justify-center"
                aria-label={
                  step.is_completed
                    ? "ทำเครื่องหมายว่ายังไม่เสร็จ"
                    : "ทำเครื่องหมายว่าเสร็จ"
                }
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-finance-primary text-finance-primary-strong">
                  {step.is_completed ? "✓" : ""}
                </span>
              </button>
            </form>
            <p
              className={`min-w-0 flex-1 text-sm text-finance-text ${step.is_completed ? "text-finance-muted line-through" : ""}`}
            >
              {step.title}
            </p>
            <form action={deletePlanTaskStepAction}>
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="stepId" value={step.id} />
              <button
                type="submit"
                className="min-h-9 px-2 text-xs text-danger"
              >
                ลบ
              </button>
            </form>
          </div>
        ))}
      </div>
      <form action={addAction} className="mt-3 flex gap-2">
        <input type="hidden" name="taskId" value={taskId} />
        <input
          name="title"
          required
          maxLength={240}
          placeholder="เพิ่มรายการย่อย"
          className="h-11 min-w-0 flex-1 rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong px-3 text-finance-text outline-none placeholder:text-finance-muted focus:border-finance-primary"
        />
        <SubmitButton size="md" className="w-auto">
          เพิ่ม
        </SubmitButton>
      </form>
      {state.error ? (
        <p className="mt-2 text-sm text-danger" aria-live="polite">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
