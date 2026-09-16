import type { ReportDay } from "@/features/reports/types";
import { addMoney } from "@/lib/utils/money";

export interface FinanceTrendPoint {
  date: string;
  income: string;
  expense: string;
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
