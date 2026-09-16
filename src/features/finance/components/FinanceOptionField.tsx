"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/lib/utils/cn";

export type FinanceOption = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type EmptyChoice = {
  label: string;
  description?: string;
};

export function FinanceOptionField({
  label,
  title,
  name,
  options,
  value,
  onChange,
  placeholder = "เลือก",
  emptyChoice,
  disabled = false,
}: {
  label: string;
  title: string;
  name?: string | null;
  options: FinanceOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyChoice?: EmptyChoice;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value) ?? null;

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div>
        <p className="mb-1 text-sm font-medium text-finance-muted">{label}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex min-h-[72px] w-full flex-col justify-center rounded-[1rem] border border-finance-primary-soft bg-finance-surface-strong p-3 text-left shadow-sm disabled:opacity-50"
        >
          <span className="truncate text-sm font-semibold text-finance-text">
            {selected?.label ?? emptyChoice?.label ?? placeholder}
          </span>
          {selected?.description ?? emptyChoice?.description ? (
            <span className="mt-1 truncate text-xs text-finance-muted">
              {selected?.description ?? emptyChoice?.description}
            </span>
          ) : null}
        </button>
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        tone="finance"
      >
        <div className="flex flex-col gap-2">
          {emptyChoice ? (
            <button
              type="button"
              onClick={() => choose("")}
              className={cn(
                "flex min-h-16 w-full flex-col justify-center rounded-2xl px-3 py-2 text-left",
                value ? "bg-finance-surface-strong" : "bg-finance-primary-soft",
              )}
            >
              <span className="font-medium text-finance-text">
                {emptyChoice.label}
              </span>
              {emptyChoice.description ? (
                <span className="text-xs text-finance-muted">
                  {emptyChoice.description}
                </span>
              ) : null}
            </button>
          ) : null}

          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={() => choose(option.id)}
              className={cn(
                "flex min-h-16 w-full flex-col justify-center rounded-2xl px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40",
                option.id === value
                  ? "bg-finance-primary-soft"
                  : "bg-finance-surface-strong",
              )}
            >
              <span className="font-medium text-finance-text">
                {option.label}
              </span>
              {option.description ? (
                <span className="text-xs text-finance-muted">
                  {option.description}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
