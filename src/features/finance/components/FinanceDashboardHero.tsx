import Image from "next/image";
import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { formatCurrency } from "@/lib/utils/money";

type MoneyTotal = { currency: string; amount: string };
type MonthTotal = { currency: string; income: string; expense: string };

export function FinanceDashboardHero({
  balances,
  monthTotals,
  addItemHref,
}: {
  balances: MoneyTotal[];
  monthTotals: MonthTotal[];
  addItemHref: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link href={addItemHref} className="flex min-h-20 items-center justify-between rounded-[1.5rem] bg-[linear-gradient(135deg,#f6a28c,#ef8d76)] px-5 text-white shadow-[0_12px_28px_rgb(217_120_95_/_0.25)] transition-transform active:scale-[.99]" aria-label="เพิ่มรายการการเงิน">
        <span className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-full bg-white/22"><AppIcon name="plus" className="size-7" /></span><span><span className="block text-lg font-bold">เพิ่มรายการ</span><span className="block text-xs text-white/80">รายจ่าย รายรับ หรือโอนเงิน</span></span></span>
        <AppIcon name="chevron" className="size-6" />
      </Link>

      <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-white/80 bg-[linear-gradient(135deg,#fffdf8_0%,#f4f7e9_60%,#e8f2df_100%)] p-5 shadow-[0_14px_40px_rgb(111_90_67_/_0.10)]">
        <div className="relative z-10 min-h-44 max-w-[58%]">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-finance-text">ยอดเงินส่วนตัว</p>
            <span className="flex size-8 items-center justify-center rounded-full bg-white/80 text-finance-muted shadow-sm">
              <AppIcon name="wallet" className="size-4" />
            </span>
          </div>
          <div className="mt-3 space-y-1">
            {balances.length ? balances.map((total) => (
              <p key={total.currency} className="text-[clamp(1.55rem,7vw,2.35rem)] font-bold leading-none tracking-tight tabular-nums text-[#35221e]">
                {formatCurrency(total.amount, total.currency)}
              </p>
            )) : <p className="text-3xl font-bold text-[#35221e]">฿0.00</p>}
          </div>
          <p className="mt-3 text-sm text-finance-muted">ดูแลตัวเองได้ วันนี้ก็เก่งแล้ว</p>
        </div>
        <Image
          src="/illustrations/finance/home-hero.webp"
          alt="คนกอดแมวท่ามกลางต้นไม้"
          width={620}
          height={310}
          priority
          className="pointer-events-none absolute -bottom-1 -right-12 z-0 h-auto w-[64%] max-w-[23rem] object-contain"
        />

        <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 border-t border-white/80 pt-3 sm:grid-cols-3">
          {monthTotals.length ? monthTotals.flatMap((total) => [
            <Metric key={`${total.currency}-expense`} label="ใช้จ่ายเดือนนี้" value={formatCurrency(total.expense, total.currency)} tone="expense" />,
            <Metric key={`${total.currency}-income`} label="รายรับเดือนนี้" value={formatCurrency(total.income, total.currency)} tone="income" />,
          ]) : <Metric label="ใช้จ่ายเดือนนี้" value="฿0.00" tone="expense" />}
          <Link href="/finance/budgets" className="col-span-2 flex min-h-16 items-center justify-between rounded-2xl bg-white/75 px-4 sm:col-span-1">
            <span><span className="block text-xs text-finance-muted">งบประมาณ</span><span className="font-semibold text-finance-text">ดูวงเงินคงเหลือ</span></span>
            <AppIcon name="chevron" className="size-5 text-finance-primary-strong" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" }) {
  return (
    <div className="rounded-2xl bg-white/75 px-4 py-3">
      <p className="text-xs text-finance-muted">{label}</p>
      <p className={`mt-0.5 truncate text-base font-semibold tabular-nums ${tone === "income" ? "text-finance-income" : "text-finance-expense"}`}>{value}</p>
    </div>
  );
}
