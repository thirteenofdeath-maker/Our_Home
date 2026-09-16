"use client";

import { useRouter } from "next/navigation";

export function MonthPicker({
  month,
  label,
}: {
  month: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <label className="relative flex min-h-11 min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-full px-3 text-center text-lg font-semibold text-finance-text transition-colors hover:bg-finance-primary-soft/45 focus-within:outline-2 focus-within:outline-finance-primary">
      <span className="truncate">{label}</span>
      <input
        type="month"
        value={month}
        aria-label="เลือกเดือน"
        onChange={(event) => {
          if (event.target.value) {
            router.push(`/calendar?month=${event.target.value}`);
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
