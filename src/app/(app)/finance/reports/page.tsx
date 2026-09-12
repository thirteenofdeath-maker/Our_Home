import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { currentFinanceMonth, financeMonthRange, shiftFinanceMonth } from "@/features/finance/domain/finance";
import { FinanceDonutChart, type DonutSegment } from "@/features/finance/components/FinanceDonutChart";
import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { FinanceSegmentedControl } from "@/features/finance/components/FinanceSegmentedControl";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { getFinanceReport } from "@/features/reports/api";
import type { ReportCategory } from "@/features/reports/types";
import { requireUser } from "@/lib/auth/require-user";
import { compareMoney, formatCurrency, percentOfTotal, subtractMoney, sumMoney } from "@/lib/utils/money";

type View = "category" | "month" | "compare";
type ReportType = "EXPENSE" | "INCOME";

const DONUT_COLORS = ["stroke-finance-expense", "stroke-finance-primary", "stroke-finance-warning", "stroke-finance-transfer", "stroke-finance-income"];

function monthLabelOf(month: string): string {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) if (value) query.set(key, value);
  const queryString = query.toString();
  return queryString ? `/finance/reports?${queryString}` : "/finance/reports";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; type?: string; month?: string; months?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);

  const view: View = params.view === "month" || params.view === "compare" ? params.view : "category";
  const type: ReportType = params.type === "INCOME" ? "INCOME" : "EXPENSE";
  const scope: "PERSONAL" | "HOUSEHOLD" = params.scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";
  const householdId = scope === "HOUSEHOLD" ? (household?.id ?? null) : null;

  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentFinanceMonth();
  const monthsCount = params.months === "3" ? 3 : params.months === "12" ? 12 : 6;

  // "หมวดหมู่" reads a single selected month (real prev/next navigation,
  // same contract as Budget's own month nav); "เดือน"/"เปรียบเทียบ" read
  // the existing 3/6/12 trailing window ending at the current month. Both
  // paths call the SAME existing get_finance_reports RPC — only the
  // start/end range passed to it differs; no new query either way.
  const range = view === "category" ? financeMonthRange(month) : { start: financeMonthRange(shiftFinanceMonth(currentFinanceMonth(), 1 - monthsCount)).start, end: financeMonthRange(currentFinanceMonth()).end };
  const report = await getFinanceReport(supabase, scope, householdId, range.start, range.end);

  const commonParams = { view, type, month, months: String(monthsCount), scope: scope === "HOUSEHOLD" ? "HOUSEHOLD" : undefined };

  return (
    <div className="flex flex-col gap-4">
      <FinanceSegmentedControl
        ariaLabel="มุมมองรายงาน"
        activeValue={view}
        options={[
          { value: "category", label: "หมวดหมู่", href: buildHref(commonParams, { view: "category" }) },
          { value: "month", label: "เดือน", href: buildHref(commonParams, { view: "month" }) },
          { value: "compare", label: "เปรียบเทียบ", href: buildHref(commonParams, { view: "compare" }) },
        ]}
      />

      {household ? (
        <FinanceSegmentedControl
          ariaLabel="ขอบเขต"
          activeValue={scope}
          options={[
            { value: "PERSONAL", label: "ส่วนตัว", href: buildHref(commonParams, { scope: undefined }) },
            { value: "HOUSEHOLD", label: "ครอบครัว", href: buildHref(commonParams, { scope: "HOUSEHOLD" }) },
          ]}
        />
      ) : null}

      {view === "category" ? (
        <>
          <div className="flex items-center justify-between">
            <Link href={buildHref(commonParams, { month: shiftFinanceMonth(month, -1) })} aria-label="เดือนก่อนหน้า" className="flex size-9 items-center justify-center rounded-full bg-finance-surface-strong text-finance-text shadow-sm">
              <AppIcon name="chevron" className="size-4 rotate-180" />
            </Link>
            <p className="font-medium text-finance-text">{monthLabelOf(month)}</p>
            <Link href={buildHref(commonParams, { month: shiftFinanceMonth(month, 1) })} aria-label="เดือนถัดไป" className="flex size-9 items-center justify-center rounded-full bg-finance-surface-strong text-finance-text shadow-sm">
              <AppIcon name="chevron" className="size-4" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {report.months.length ? (
              report.months.map((m) => (
                <div key={m.currency} className="col-span-3 grid w-full grid-cols-3 gap-2 rounded-[1.25rem] bg-finance-surface-strong p-3">
                  {/* min-w-0 on each column: a grid item's automatic min
                      width otherwise defaults to its content's min-content
                      size, which can force a column wider than its 1fr
                      share and squeeze the row instead of letting the
                      truncate below actually ellipsize. */}
                  <div className="min-w-0">
                    <p className="text-xs text-finance-muted">รายจ่ายรวม</p>
                    <p className="truncate font-semibold tabular-nums text-finance-expense">{formatCurrency(m.expense, m.currency)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-finance-muted">รายรับรวม</p>
                    <p className="truncate font-semibold tabular-nums text-finance-income">{formatCurrency(m.income, m.currency)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-finance-muted">สุทธิ</p>
                    <p className="truncate font-semibold tabular-nums text-finance-text">{formatCurrency(subtractMoney(m.income, m.expense), m.currency)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3">
                <FinanceEmptyState icon="finance" title="ยังไม่มีข้อมูลเดือนนี้" description="เมื่อมีรายการ ตัวเลขจะแสดงที่นี่" />
              </div>
            )}
          </div>

          <FinanceSegmentedControl
            ariaLabel="ประเภทหมวดหมู่"
            activeValue={type}
            options={[
              { value: "EXPENSE", label: "รายจ่าย", href: buildHref(commonParams, { type: "EXPENSE" }) },
              { value: "INCOME", label: "รายรับ", href: buildHref(commonParams, { type: "INCOME" }) },
            ]}
          />

          <CategoryReport categories={report.categories.filter((c) => c.type === type)} type={type} />
        </>
      ) : null}

      {view === "month" ? (
        <>
          <FinanceSegmentedControl
            ariaLabel="ช่วงเวลา"
            activeValue={String(monthsCount)}
            options={[
              { value: "3", label: "3 เดือน", href: buildHref(commonParams, { months: "3" }) },
              { value: "6", label: "6 เดือน", href: buildHref(commonParams, { months: "6" }) },
              { value: "12", label: "12 เดือน", href: buildHref(commonParams, { months: "12" }) },
            ]}
          />
          {report.months.length === 0 ? (
            <FinanceEmptyState icon="finance" title="ยังไม่มีข้อมูล" description="ยังไม่มีรายการในช่วงเวลานี้" />
          ) : (
            <div className="flex flex-col gap-2">
              {report.months.map((m) => (
                <div key={`${m.month}-${m.currency}`} className="flex items-center justify-between rounded-[1.25rem] bg-finance-surface-strong p-3">
                  <span className="text-sm font-medium text-finance-text">
                    {m.month} <span className="text-xs text-finance-muted">· {m.currency}</span>
                  </span>
                  <span className="flex gap-3 text-sm tabular-nums">
                    <span className="text-finance-income">+{formatCurrency(m.income, m.currency)}</span>
                    <span className="text-finance-expense">−{formatCurrency(m.expense, m.currency)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {view === "compare" ? (
        <>
          <FinanceSegmentedControl
            ariaLabel="ช่วงเวลา"
            activeValue={String(monthsCount)}
            options={[
              { value: "3", label: "3 เดือน", href: buildHref(commonParams, { months: "3" }) },
              { value: "6", label: "6 เดือน", href: buildHref(commonParams, { months: "6" }) },
              { value: "12", label: "12 เดือน", href: buildHref(commonParams, { months: "12" }) },
            ]}
          />
          {report.months.length === 0 ? (
            <FinanceEmptyState icon="finance" title="ยังไม่มีข้อมูล" description="ยังไม่มีรายการในช่วงเวลานี้" />
          ) : (
            Array.from(new Set(report.months.map((m) => m.currency))).map((currency) => (
              <CompareChart key={currency} currency={currency} months={report.months.filter((m) => m.currency === currency)} />
            ))
          )}
        </>
      ) : null}
    </div>
  );
}

function CategoryReport({ categories, type }: { categories: ReportCategory[]; type: ReportType }) {
  if (categories.length === 0) {
    return (
      <FinanceEmptyState
        icon="finance"
        title={type === "EXPENSE" ? "ยังไม่มีรายจ่ายตามหมวดหมู่" : "ยังไม่มีรายรับตามหมวดหมู่"}
        description="เพิ่มรายการเพื่อดูสัดส่วนตามหมวดหมู่"
      />
    );
  }

  // One donut per currency present — never combined across currencies.
  const byCurrency = new Map<string, ReportCategory[]>();
  for (const category of categories) {
    const list = byCurrency.get(category.currency) ?? [];
    list.push(category);
    byCurrency.set(category.currency, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byCurrency.entries()].map(([currency, rows]) => {
        // Exact decimal-string arithmetic throughout: sorting compares
        // integer cents (compareMoney), the denominator is an exact sum
        // (sumMoney), and each row's ratio/percent is derived from
        // integer-cents division (percentOfTotal) — never Number(amount).
        // The displayed amount itself always comes from formatCurrency on
        // the original decimal string, never a derived ratio.
        const sortedRows = [...rows].sort((a, b) => compareMoney(b.amount, a.amount));
        const total = sumMoney(sortedRows.map((row) => row.amount));
        const segments: DonutSegment[] = sortedRows.map((row, index) => ({
          id: row.categoryId ?? row.name,
          ratio: percentOfTotal(row.amount, total) / 100,
          colorClassName: DONUT_COLORS[index % DONUT_COLORS.length]!,
        }));

        return (
          <div key={currency} className="flex flex-col gap-3 rounded-[1.25rem] bg-finance-surface-strong p-4">
            {byCurrency.size > 1 ? <p className="text-xs font-medium text-finance-muted">{currency}</p> : null}
            <div className="flex items-center justify-center">
              <FinanceDonutChart segments={segments} />
            </div>
            <div className="flex flex-col gap-2">
              {sortedRows.map((row, index) => {
                const percent = percentOfTotal(row.amount, total);
                return (
                  <div key={row.categoryId ?? row.name} className="flex items-center gap-3">
                    <span className={`size-2.5 shrink-0 rounded-full ${DONUT_COLORS[index % DONUT_COLORS.length]!.replace("stroke-", "bg-")}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-finance-text">{row.name}</span>
                    <span className="shrink-0 text-xs text-finance-muted">{percent.toFixed(0)}%</span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-finance-text">{formatCurrency(row.amount, row.currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareChart({ currency, months }: { currency: string; months: Array<{ month: string; income: string; expense: string }> }) {
  const maxValue = Math.max(1, ...months.flatMap((m) => [Number(m.income), Number(m.expense)]));
  return (
    <div className="flex flex-col gap-3 rounded-[1.25rem] bg-finance-surface-strong p-4">
      <p className="text-xs font-medium text-finance-muted">รายรับเทียบรายจ่าย · {currency}</p>
      <div className="flex h-40 gap-2">
        {months.map((m) => (
          <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end gap-0.5">
              <div className="w-full rounded-t-sm bg-finance-expense/70" style={{ height: `${Math.max((Number(m.expense) / maxValue) * 100, 2)}%` }} />
              <div className="w-full rounded-t-sm bg-finance-income/70" style={{ height: `${Math.max((Number(m.income) / maxValue) * 100, 2)}%` }} />
            </div>
            <p className="text-[10px] text-finance-muted">{m.month.slice(5)}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-finance-muted">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-finance-expense/70" /> รายจ่าย</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-finance-income/70" /> รายรับ</span>
      </div>
    </div>
  );
}
