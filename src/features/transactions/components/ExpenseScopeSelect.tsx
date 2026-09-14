"use client";

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
            { scope: "PERSONAL" as const, label: "ส่วนตัว" },
            { scope: "HOUSEHOLD" as const, label: "ครอบครัว" },
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
                ? "flex h-13 items-center justify-center rounded-control border-2 border-primary bg-primary-soft text-base font-medium text-foreground"
                : "flex h-13 items-center justify-center rounded-control border border-border/70 bg-surface text-base text-foreground-muted"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
