import type { ReportDay } from "@/features/reports/types";
import { addMoney, formatCurrency, subtractMoney } from "@/lib/utils/money";

export interface FinanceTrendPoint {
  date: string;
  income: string;
  expense: string;
}

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

export function buildCumulativeDailyTrend(
  month: string,
  days: ReportDay[],
  currency: string,
): FinanceTrendPoint[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dayTotals = new Map(
    days
      .filter((item) => item.currency === currency)
      .map((item) => [item.date, item] as const),
  );
  let income = "0.00";
  let expense = "0.00";
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const point = dayTotals.get(date);
    income = addMoney(income, point?.income ?? "0.00");
    expense = addMoney(expense, point?.expense ?? "0.00");
    return { date, income, expense };
  });
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
  previousExpense: string;
}) {
  const visibleTrend = throughDay
    ? trend.slice(0, Math.max(1, Math.min(throughDay, trend.length)))
    : trend;
  const currentExpenseValues = visibleTrend.map((point) =>
    Number(point.expense),
  );
  const previousExpenseValues = trend.map((_, index) =>
    Number(
      comparisonTrend[Math.min(index, comparisonTrend.length - 1)]?.expense ??
        "0",
    ),
  );
  const maxValue = Math.max(
    1,
    ...currentExpenseValues,
    ...previousExpenseValues,
  );
  const currentExpensePath = buildSeriesPath(
    currentExpenseValues,
    maxValue,
    trend.length,
  );
  const previousExpensePath = buildSeriesPath(
    previousExpenseValues,
    maxValue,
    trend.length,
  );
  const hasActivity = [...currentExpenseValues, ...previousExpenseValues].some(
    (value) => value !== 0,
  );
  const currentEndX =
    trend.length <= 1
      ? CHART_WIDTH / 2
      : ((currentExpenseValues.length - 1) / (trend.length - 1)) * CHART_WIDTH;
  const fillPath = currentExpensePath
    ? `${currentExpensePath} L${currentEndX.toFixed(2)} ${CHART_BOTTOM} L0 ${CHART_BOTTOM} Z`
    : "";
  const gradientId = `expense-area-${currency.replace(/[^a-z0-9]/gi, "-")}`;
  const difference = subtractMoney(expense, previousExpense);
  const isEqual = difference === "0.00" || difference === "-0.00";
  const absoluteDifference = difference.startsWith("-")
    ? difference.slice(1)
    : difference;
  const comparisonText = isEqual
    ? "รายจ่ายเท่ากับเดือนก่อน"
    : `รายจ่าย${difference.startsWith("-") ? "ลดลง" : "เพิ่มขึ้น"} ${formatCurrency(absoluteDifference, currency)} จากเดือนก่อน`;

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-finance-text">
            แนวโน้มรายจ่าย{showCurrencyLabel ? ` · ${currency}` : ""}
          </h3>
          <p className="mt-0.5 text-xs text-finance-muted">
            {monthLabel} · วันที่ 1–{trend.length}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1 text-[11px] text-finance-muted sm:flex-row sm:gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-finance-expense" />
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
            aria-label={`กราฟเปรียบเทียบรายจ่าย ${currency} ${monthLabel} กับ ${comparisonMonthLabel}`}
            className="h-36 w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--finance-expense)"
                  stopOpacity="0.18"
                />
                <stop
                  offset="100%"
                  stopColor="var(--finance-income)"
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
              data-series="previous-expense"
              d={previousExpensePath}
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
              className="text-finance-expense"
            />
            <path
              data-series="current-expense"
              d={currentExpensePath}
              fill="none"
              stroke="currentColor"
              className="text-finance-expense"
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
            ยังไม่มีข้อมูลรายจ่ายสำหรับเปรียบเทียบ
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 divide-x divide-finance-primary/15 rounded-[1rem] bg-finance-primary-soft/45 py-3 text-center">
        <FinanceTotal
          label="รายรับรวม"
          value={formatCurrency(income, currency)}
          tone="income"
        />
        <FinanceTotal
          label="รายจ่ายรวม"
          value={formatCurrency(expense, currency)}
          tone="expense"
        />
        <FinanceTotal
          label="รายจ่ายเดือนก่อน"
          value={formatCurrency(previousExpense, currency)}
          tone="default"
        />
      </div>
      <p
        className={`mt-2 text-center text-xs font-medium ${isEqual ? "text-finance-muted" : difference.startsWith("-") ? "text-finance-income" : "text-finance-expense"}`}
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
