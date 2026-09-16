import type { ReportDay } from "@/features/reports/types";
import { addMoney, formatCurrency } from "@/lib/utils/money";

export interface FinanceTrendPoint {
  date: string;
  income: string;
  expense: string;
}

const CHART_WIDTH = 320;
const CHART_TOP = 12;
const CHART_BOTTOM = 112;

export function buildSeriesPath(values: number[], maxValue: number) {
  if (!values.length) return "";
  const denominator = Math.max(maxValue, 1);
  return values
    .map((value, index) => {
      const x =
        values.length === 1
          ? CHART_WIDTH / 2
          : (index / (values.length - 1)) * CHART_WIDTH;
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
  income,
  expense,
  net,
}: {
  currency: string;
  showCurrencyLabel: boolean;
  trend: FinanceTrendPoint[];
  income: string;
  expense: string;
  net: string;
}) {
  const incomeValues = trend.map((point) => Number(point.income));
  const expenseValues = trend.map((point) => Number(point.expense));
  const maxValue = Math.max(1, ...incomeValues, ...expenseValues);
  const incomePath = buildSeriesPath(incomeValues, maxValue);
  const expensePath = buildSeriesPath(expenseValues, maxValue);
  const hasActivity = [...incomeValues, ...expenseValues].some(
    (value) => value !== 0,
  );
  const fillPath = incomePath
    ? `${incomePath} L${CHART_WIDTH} ${CHART_BOTTOM} L0 ${CHART_BOTTOM} Z`
    : "";
  const gradientId = `income-area-${currency.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-finance-text">
            ภาพรวมรายรับ–รายจ่าย{showCurrencyLabel ? ` · ${currency}` : ""}
          </h3>
          <p className="mt-0.5 text-xs text-finance-muted">
            ยอดสะสมรายวัน · วันที่ 1–{trend.length}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1 text-[11px] text-finance-muted sm:flex-row sm:gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-finance-income" />
            รายรับ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-finance-expense" />
            รายจ่าย
          </span>
        </div>
      </div>

      {trend.length > 0 ? (
        <div className="relative mt-4 min-w-0">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} 132`}
            role="img"
            aria-label={`กราฟรายรับและรายจ่าย ${currency} รายวัน ${trend[0]?.date.slice(0, 7) ?? ""}`}
            className="h-36 w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--finance-income)"
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
              d={fillPath}
              fill={`url(#${gradientId})`}
              className="text-finance-income"
            />
            <path
              data-series="income"
              d={incomePath}
              fill="none"
              stroke="currentColor"
              className="text-finance-income"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              data-series="expense"
              d={expensePath}
              fill="none"
              stroke="currentColor"
              className="text-finance-expense"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="7 4"
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
            ยังไม่มีข้อมูลรายรับ–รายจ่าย
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
          label="คงเหลือ"
          value={formatCurrency(net, currency)}
          tone={net.startsWith("-") ? "expense" : "default"}
        />
      </div>
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
