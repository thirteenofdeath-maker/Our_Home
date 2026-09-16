"use client";

import { useState } from "react";

import type { FinanceTrendPoint } from "@/features/finance/domain/finance-trend";
import { formatCurrency, subtractMoney } from "@/lib/utils/money";

const CHART_WIDTH = 320;
const CHART_TOP = 12;
const CHART_BOTTOM = 112;

export function buildSeriesPath(
  values: number[],
  maxValue: number,
  totalPoints = values.length,
) {
  if (!values.length) return "";
  const denominator = Math.max(maxValue, 1);
  const slots = Math.max(totalPoints, values.length, 1);
  return values
    .map((value, index) => {
      const x =
        slots === 1 ? CHART_WIDTH / 2 : (index / (slots - 1)) * CHART_WIDTH;
      const y =
        CHART_BOTTOM -
        (Math.max(value, 0) / denominator) * (CHART_BOTTOM - CHART_TOP);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function dayLabel(date: string) {
  return String(Number(date.slice(-2)));
}

export function FinanceTrendCard({
  currency,
  showCurrencyLabel,
  trend,
  comparisonTrend,
  monthLabel,
  comparisonMonthLabel,
  throughDay,
  income,
  expense,
  previousIncome,
  previousExpense,
}: {
  currency: string;
  showCurrencyLabel: boolean;
  trend: FinanceTrendPoint[];
  comparisonTrend: FinanceTrendPoint[];
  monthLabel: string;
  comparisonMonthLabel: string;
  throughDay?: number;
  income: string;
  expense: string;
  previousIncome: string;
  previousExpense: string;
}) {
  const [mode, setMode] = useState<"income" | "expense">("expense");
  const visibleTrend = throughDay
    ? trend.slice(0, Math.max(1, Math.min(throughDay, trend.length)))
    : trend;
  const currentValues = visibleTrend.map((point) => Number(point[mode]));
  const previousValues = trend.map((_, index) =>
    Number(
      comparisonTrend[Math.min(index, comparisonTrend.length - 1)]?.[mode] ??
        "0",
    ),
  );
  const maxValue = Math.max(1, ...currentValues, ...previousValues);
  const currentPath = buildSeriesPath(currentValues, maxValue, trend.length);
  const previousPath = buildSeriesPath(previousValues, maxValue, trend.length);
  const hasActivity = [...currentValues, ...previousValues].some(
    (value) => value !== 0,
  );
  const currentEndX =
    trend.length <= 1
      ? CHART_WIDTH / 2
      : ((currentValues.length - 1) / (trend.length - 1)) * CHART_WIDTH;
  const fillPath = currentPath
    ? `${currentPath} L${currentEndX.toFixed(2)} ${CHART_BOTTOM} L0 ${CHART_BOTTOM} Z`
    : "";
  const gradientId = `${mode}-area-${currency.replace(/[^a-z0-9]/gi, "-")}`;
  const currentTotal = mode === "income" ? income : expense;
  const previousTotal = mode === "income" ? previousIncome : previousExpense;
  const difference = subtractMoney(currentTotal, previousTotal);
  const isEqual = difference === "0.00" || difference === "-0.00";
  const absoluteDifference = difference.startsWith("-")
    ? difference.slice(1)
    : difference;
  const modeLabel = mode === "income" ? "รายรับ" : "รายจ่าย";
  const comparisonText = isEqual
    ? `${modeLabel}เท่ากับเดือนก่อน`
    : `${modeLabel}${difference.startsWith("-") ? "ลดลง" : "เพิ่มขึ้น"} ${formatCurrency(absoluteDifference, currency)} จากเดือนก่อน`;
  const differenceTone = isEqual
    ? "default"
    : (mode === "income") !== difference.startsWith("-")
      ? "income"
      : "expense";
  const currentTone =
    mode === "income" ? "text-finance-income" : "text-finance-expense";
  const currentDot =
    mode === "income" ? "bg-finance-income" : "bg-finance-expense";

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-finance-text">
          แนวโน้ม{showCurrencyLabel ? ` · ${currency}` : ""}
        </h3>
        <div
          role="tablist"
          aria-label="เลือกประเภทแนวโน้ม"
          className="flex rounded-full bg-finance-primary-soft/60 p-1 text-xs font-medium"
        >
          {(["income", "expense"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`min-h-8 rounded-full px-3 transition-colors ${mode === value ? "bg-finance-surface-strong text-finance-text shadow-sm" : "text-finance-muted"}`}
            >
              {value === "income" ? "รายรับ" : "รายจ่าย"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-xs text-finance-muted">
          {monthLabel} · วันที่ 1–{trend.length}
        </p>
        <div className="flex shrink-0 flex-col gap-1 text-[11px] text-finance-muted sm:flex-row sm:gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${currentDot}`} />
            {monthLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-finance-muted/35" />
            {comparisonMonthLabel}
          </span>
        </div>
      </div>

      {trend.length > 0 ? (
        <div className="relative mt-4 min-w-0">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} 132`}
            role="img"
            aria-label={`กราฟเปรียบเทียบ${modeLabel} ${currency} ${monthLabel} กับ ${comparisonMonthLabel}`}
            className="h-36 w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={`var(--finance-${mode})`}
                  stopOpacity="0.18"
                />
                <stop
                  offset="100%"
                  stopColor={`var(--finance-${mode})`}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {[CHART_TOP, 62, CHART_BOTTOM].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2={CHART_WIDTH}
                y2={y}
                stroke="currentColor"
                className="text-finance-primary-soft"
                strokeDasharray="4 5"
              />
            ))}
            <path
              data-series={`previous-${mode}`}
              d={previousPath}
              fill="none"
              stroke="currentColor"
              className="text-finance-muted/35"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={fillPath}
              fill={`url(#${gradientId})`}
              className={currentTone}
            />
            <path
              data-series={`current-${mode}`}
              d={currentPath}
              fill="none"
              stroke="currentColor"
              className={currentTone}
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {!hasActivity ? (
            <p className="pointer-events-none absolute inset-x-0 top-14 text-center text-xs text-finance-muted">
              ยังไม่มีรายการในช่วงนี้
            </p>
          ) : null}
          <div className="mt-1 flex justify-between text-[10px] text-finance-muted">
            {trend
              .filter(
                (_, index) =>
                  index === 0 ||
                  index === trend.length - 1 ||
                  (index + 1) % 5 === 0,
              )
              .map((point) => (
                <span key={point.date}>{dayLabel(point.date)}</span>
              ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex h-36 items-center justify-center rounded-[1rem] bg-finance-primary-soft/55">
          <p className="text-xs text-finance-muted">
            ยังไม่มีข้อมูล{modeLabel}สำหรับเปรียบเทียบ
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 divide-x divide-finance-primary/15 rounded-[1rem] bg-finance-primary-soft/45 py-3 text-center">
        <FinanceTotal
          label={`${modeLabel}รวม`}
          value={formatCurrency(currentTotal, currency)}
          tone={mode}
        />
        <FinanceTotal
          label={`${modeLabel}เดือนก่อน`}
          value={formatCurrency(previousTotal, currency)}
          tone="default"
        />
        <FinanceTotal
          label="ผลต่าง"
          value={`${difference.startsWith("-") ? "−" : isEqual ? "" : "+"}${formatCurrency(absoluteDifference, currency)}`}
          tone={differenceTone}
        />
      </div>
      <p
        className={`mt-2 text-center text-xs font-medium ${differenceTone === "income" ? "text-finance-income" : differenceTone === "expense" ? "text-finance-expense" : "text-finance-muted"}`}
      >
        {comparisonText}
      </p>
    </div>
  );
}

function FinanceTotal({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "default";
}) {
  return (
    <div className="min-w-0 px-1.5">
      <p className="truncate text-[11px] text-finance-muted">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-semibold tabular-nums ${tone === "income" ? "text-finance-income" : tone === "expense" ? "text-finance-expense" : "text-finance-text"}`}
      >
        {value}
      </p>
    </div>
  );
}
