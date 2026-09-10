import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { getBudgetSummary } from "@/features/budgets/api";
import { BudgetCard } from "@/features/budgets/components/BudgetCard";
import { listBills, listBillOccurrences, materializeBills } from "@/features/bills/api";
import { BillOccurrenceCard } from "@/features/bills/components/BillOccurrenceCard";
import { listGoals } from "@/features/goals/api";
import { GoalCard } from "@/features/goals/components/GoalCard";
import { listDebts } from "@/features/debts/api";
import { getFinanceSummary, listRecentFinanceTransactions } from "@/features/finance/api";
import {
  currentFinanceMonth,
  financeExpenseHref,
  financeIncomeHref,
  financeMonthRange,
  financeMonthToPeriodMonth,
  financeTransferHref,
  shiftFinanceMonth,
} from "@/features/finance/domain/finance";
import { getFinalHub } from "@/features/finance/final-api";
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import { listUpcomingOccurrencesForScope, materializeRecurringOccurrences } from "@/features/recurring/api";
import { OccurrenceCard } from "@/features/recurring/components/OccurrenceCard";
import { TransactionHistoryList } from "@/features/transactions/components/TransactionHistoryList";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

export default async function FinancePage() {
  const { supabase } = await requireUser();
  const month = currentFinanceMonth();
  const monthRange = financeMonthRange(month);
  // Personal-scope only on the Hub, matching Budget's compact section —
  // a household's upcoming items are visible in full on /finance/recurring.
  await materializeRecurringOccurrences(supabase, { scope: "PERSONAL" });
  await materializeBills(supabase, { scope: "PERSONAL" });
  const trendStart=financeMonthRange(shiftFinanceMonth(month,-5)).start;
  const [wallets, summary, recent, budgets, upcomingRecurring, bills, goals, debts, finalHub] = await Promise.all([
    listMyWallets(supabase),
    getFinanceSummary(supabase, monthRange),
    listRecentFinanceTransactions(supabase, 10),
    getBudgetSummary(supabase, { periodMonth: financeMonthToPeriodMonth(month), monthStart: monthRange.start, monthEnd: monthRange.end }),
    listUpcomingOccurrencesForScope(supabase, { scope: "PERSONAL", limit: 3 }),
    listBills(supabase, { scope: "PERSONAL" }),
    listGoals(supabase, "PERSONAL"),
    listDebts(supabase, "PERSONAL"),
    getFinalHub(supabase,{start:trendStart,end:monthRange.end,today:bangkokDateKey()}),
  ]);
  const billOccurrences = await listBillOccurrences(supabase, bills.filter((b) => !b.pausedAt).map((b) => b.billId), { status: "OPEN", limit: 3 });
  billOccurrences.sort((a, b) => {
    const rank = (status: string) => (status === "OVERDUE" ? 0 : status === "DUE" ? 1 : 2);
    return rank(a.displayStatus) - rank(b.displayStatus) || a.dueDate.localeCompare(b.dueDate);
  });
  const balanceByWallet = new Map(summary.walletBalances.map((item) => [item.walletId, item.amount]));
  // Initial route convenience only. TransactionForm visibly exposes all active
  // wallets and persists no default-wallet preference.
  const initialWallet = wallets[0];
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(
    new Date(`${month}-01T00:00:00+07:00`),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">{monthLabel}</p>
        <h1 className="text-xl font-semibold">การเงิน</h1>
      </header>

      <Card className="flex flex-col gap-4 border-primary/20 bg-primary/10">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">ยอดรวม</p>
          {/* One line per currency — never summed together (see docs/DOMAIN_RULES.md). */}
          <div className="mt-1 flex flex-col gap-2">
            {summary.currencyTotals.length ? (
              summary.currencyTotals.map((total) => (
                <p key={total.currency} className="text-3xl font-semibold tabular-nums">
                  {formatCurrency(total.amount, total.currency)}
                </p>
              ))
            ) : (
              <p className="text-2xl font-semibold tabular-nums">฿0.00</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {summary.monthTotals.length ? (
            summary.monthTotals.map((total) => (
              <div key={total.currency} className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-foreground-muted">รายรับเดือนนี้ ({total.currency})</p>
                  <p className="font-semibold tabular-nums text-income">{formatCurrency(total.income, total.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">รายจ่ายเดือนนี้ ({total.currency})</p>
                  <p className="font-semibold tabular-nums text-expense">{formatCurrency(total.expense, total.currency)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-foreground-muted">รายรับเดือนนี้</p>
                <p className="font-semibold tabular-nums text-income">฿0.00</p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">รายจ่ายเดือนนี้</p>
                <p className="font-semibold tabular-nums text-expense">฿0.00</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {initialWallet ? (
        <Card className="flex flex-col gap-3">
          <div><h2 className="font-semibold">เพิ่มรายการ</h2><p className="text-sm text-foreground-muted">บันทึกรายรับ รายจ่าย หรือโอนเงิน</p></div>
          <section className="grid grid-cols-3 gap-2" aria-label="เพิ่มรายการด่วน">
            <Link href={financeIncomeHref(initialWallet.id)} className="flex min-h-12 items-center justify-center rounded-control border border-income/20 bg-income/10 px-2 text-sm font-medium text-income">+ รายรับ</Link>
            <Link href={financeExpenseHref(initialWallet.id)} className="flex min-h-12 items-center justify-center rounded-control border border-expense/20 bg-expense/10 px-2 text-sm font-medium text-expense">− รายจ่าย</Link>
            <Link href={financeTransferHref(initialWallet.id)} className="flex min-h-12 items-center justify-center rounded-control border border-transfer/20 bg-transfer/10 px-2 text-sm font-medium text-transfer">↔ โอนเงิน</Link>
          </section>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-foreground-muted">เพิ่มกระเป๋าเงินก่อนบันทึกรายการ</p>
          <Link href="/wallets/new" className="mt-2 inline-flex min-h-11 items-center text-primary">
            เพิ่มกระเป๋าเงิน
          </Link>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">กระเป๋าเงิน</h2>
          <Link href="/wallets" className="flex min-h-11 items-center text-sm text-primary">
            จัดการกระเป๋าเงิน
          </Link>
        </div>
        {wallets.map((wallet) => (
          <Link key={wallet.id} href={`/wallets/${wallet.id}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-medium">{wallet.name}</p>
                <p className="text-xs text-foreground-muted">{wallet.currency}</p>
              </div>
              <p className="tabular-nums">{formatCurrency(balanceByWallet.get(wallet.id) ?? "0.00", wallet.currency)}</p>
            </Card>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">รายการล่าสุด</h2>
          <Link href="/finance/transactions" className="flex min-h-11 items-center text-sm text-primary">
            ดูทั้งหมด
          </Link>
        </div>
        <TransactionHistoryList items={recent} />
      </section>

      {finalHub.netWorth.length?<section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">มูลค่าสุทธิ</h2><Link href="/finance/net-worth" className="text-primary">ดูรายละเอียด</Link></div><Card>{finalHub.netWorth.map(x=><p key={x.currency} className="text-lg font-semibold">{formatCurrency(x.amount,x.currency)}</p>)}</Card></section>:null}

      {finalHub.trend.length?<section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">แนวโน้ม 6 เดือน</h2><Link href="/finance/reports" className="text-primary">ดูรายงาน</Link></div>{finalHub.trend.slice(-3).map(x=><Card key={`${x.month}-${x.currency}`} className="flex justify-between"><span>{x.month} · {x.currency}</span><span className="text-sm">+{formatCurrency(x.income,x.currency)} / −{formatCurrency(x.expense,x.currency)}</span></Card>)}</section>:null}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">หมวดหมู่รายจ่ายเดือนนี้</h2>
        {summary.categoryTotals.length ? (
          summary.categoryTotals.map((category) => (
            <Card key={`${category.categoryId ?? category.name}-${category.currency}`} className="flex items-center justify-between">
              <span>{category.name}</span>
              <span className="tabular-nums text-expense">{formatCurrency(category.amount, category.currency)}</span>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-foreground-muted">ยังไม่มีรายจ่ายเดือนนี้</p>
          </Card>
        )}
      </section>

      {budgets.active.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">งบประมาณเดือนนี้</h2>
            <Link href="/finance/budgets" className="flex min-h-11 items-center text-sm text-primary">
              ดูงบทั้งหมด
            </Link>
          </div>
          {budgets.active.slice(0, 3).map((item) => (
            <BudgetCard key={item.budgetId} item={item} compact />
          ))}
        </section>
      ) : null}

      {upcomingRecurring.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">รายการประจำที่กำลังจะถึง</h2>
            <Link href="/finance/recurring" className="flex min-h-11 items-center text-sm text-primary">
              ดูทั้งหมด
            </Link>
          </div>
          {upcomingRecurring.map((item) => (
            <OccurrenceCard key={item.occurrenceId} item={item} compact />
          ))}
        </section>
      ) : null}

      {billOccurrences.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">บิลที่ต้องจ่าย</h2>
            <Link href="/finance/bills" className="flex min-h-11 items-center text-sm text-primary">ดูบิลทั้งหมด</Link>
          </div>
          {billOccurrences.map((item) => <BillOccurrenceCard key={item.occurrenceId} item={item} compact />)}
        </section>
      ) : null}

      {finalHub.installments.length?<section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">งวดผ่อนที่กำลังจะถึง</h2><Link href="/finance/installments" className="text-primary">ดูทั้งหมด</Link></div>{finalHub.installments.map(x=><Card key={x.id} className="flex justify-between"><span>{x.name} · {x.dueDate}</span><span>{formatCurrency(x.amount,x.currency)}</span></Card>)}</section>:null}

      {goals.some((goal) => !goal.archivedAt) ? <section className="flex flex-col gap-2"><div className="flex items-center justify-between"><h2 className="font-semibold">เป้าหมายการออม</h2><Link href="/finance/goals" className="text-sm text-primary">ดูทั้งหมด</Link></div>{goals.filter((goal) => !goal.archivedAt).slice(0, 3).map((goal) => <GoalCard key={goal.goalId} goal={goal} />)}</section> : null}

      {debts.some((debt) => !debt.archivedAt) ? <section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">หนี้และเงินยืม</h2><Link href="/finance/debts" className="text-sm text-primary">ดูทั้งหมด</Link></div>{debts.filter((debt) => !debt.archivedAt).slice(0,3).map((debt)=><Card key={debt.id} className="flex justify-between"><span>{debt.name}</span><span>{formatCurrency(debt.outstanding,debt.currency)}</span></Card>)}</section>:null}

      <section>
        <h2 className="mb-2 font-semibold">เครื่องมือการเงิน</h2>
        <Card className="grid grid-cols-2 gap-2">
          <Link href="/wallets" className="flex min-h-11 items-center text-primary">
            กระเป๋าเงินและ Pocket
          </Link>
          <Link href="/categories" className="flex min-h-11 items-center text-primary">
            หมวดหมู่
          </Link>
          <Link href="/finance/transactions" className="flex min-h-11 items-center text-primary">
            ประวัติรายการ
          </Link>
          <Link href="/finance/tags" className="flex min-h-11 items-center text-primary">
            แท็ก
          </Link>
          <Link href="/finance/budgets" className="flex min-h-11 items-center text-primary">
            งบประมาณ
          </Link>
          <Link href="/finance/templates" className="flex min-h-11 items-center text-primary">
            Template รายการ
          </Link>
          <Link href="/finance/recurring" className="flex min-h-11 items-center text-primary">
            รายการประจำ
          </Link>
          <Link href="/finance/bills" className="flex min-h-11 items-center text-primary">
            บิลและกำหนดจ่าย
          </Link>
          <Link href="/finance/installments" className="flex min-h-11 items-center text-primary">
            แผนผ่อนชำระ
          </Link>
          <Link href="/finance/goals" className="flex min-h-11 items-center text-primary">เป้าหมายการออม</Link>
          <Link href="/finance/debts" className="flex min-h-11 items-center text-primary">หนี้และเงินยืม</Link>
          <Link href="/finance/reports" className="flex min-h-11 items-center text-primary">รายงานการเงิน</Link>
          <Link href="/finance/import" className="flex min-h-11 items-center text-primary">นำเข้า CSV</Link>
          <Link href="/finance/export" className="flex min-h-11 items-center text-primary">ส่งออก CSV</Link>
          <Link href="/finance/net-worth" className="flex min-h-11 items-center text-primary">มูลค่าสุทธิ</Link>
          <Link href="/finance/insights" className="flex min-h-11 items-center text-primary">ข้อมูลเชิงลึก</Link>
          {initialWallet ? (
            <Link href={financeTransferHref(initialWallet.id)} className="flex min-h-11 items-center text-primary">
              โอนเงิน
            </Link>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
