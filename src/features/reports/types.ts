export interface ReportMonth {
  month: string;
  currency: string;
  income: string;
  expense: string;
}
export interface ReportDay {
  date: string;
  currency: string;
  income: string;
  expense: string;
}
export interface ReportCategory {
  type: "INCOME" | "EXPENSE";
  categoryId: string | null;
  name: string;
  currency: string;
  amount: string;
}
export interface FinanceReport {
  months: ReportMonth[];
  days: ReportDay[];
  categories: ReportCategory[];
}
