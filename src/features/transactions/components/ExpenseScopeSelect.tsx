"use client";

import { AppIcon } from "@/components/ui/AppIcon";

export type ExpenseScope = "PERSONAL" | "HOUSEHOLD";

/**
 * "รายการนี้เป็นของใคร?" — Phase U (0051). Neither option is selected by
 * default; the caller (TransactionForm) starts its own scope state at
 * `null` and this component never suggests a value of its own, since the
 * Finance dashboard's Personal/Household VIEW filter must never leak into
 * this CREATE form as a preselected value (they are independent axes —
 * one is a read-only filter, the other is what gets written).
 */
export function ExpenseScopeSelect({
  value,
  onChange,
  disabled,
}: {
  value: ExpenseScope | null;
  onChange: (value: ExpenseScope) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground-muted">รายการนี้เป็นของใคร?</span>
      <input type="hidden" name="expenseScope" value={value ?? ""} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="รายการนี้เป็นของใคร?">
        {(
          [
            { scope: "PERSONAL" as const, label: "ส่วนตัว", description: "รายจ่ายของฉัน" },
            { scope: "HOUSEHOLD" as const, label: "ครอบครัว", description: "รายจ่ายของบ้าน" },
          ]
        ).map((option) => (
          <button
            key={option.scope}
            type="button"
            role="radio"
            aria-checked={value === option.scope}
            disabled={disabled}
            onClick={() => onChange(option.scope)}
            className={
              value === option.scope
                ? "flex min-h-20 items-center justify-center gap-3 rounded-[1.25rem] border-2 border-primary bg-primary-soft px-3 text-left text-base font-medium text-foreground"
                : "flex min-h-20 items-center justify-center gap-3 rounded-[1.25rem] border border-border/70 bg-surface px-3 text-left text-base text-foreground-muted"
            }
          >
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${option.scope === "PERSONAL" ? "bg-[#fde2da] text-[#795044]" : "bg-[#dceefa] text-[#45657d]"}`}><AppIcon name={option.scope === "PERSONAL" ? "wallet" : "household"} /></span>
            <span><span className="block font-bold">{option.label}</span><span className="block text-xs font-normal opacity-75">{option.description}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
