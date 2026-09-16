import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { getNetWorthDashboard } from "@/features/net-worth/api";
import { NetWorthCurrencyCard } from "@/features/net-worth/components/NetWorthCurrencyCard";
import { requireUser } from "@/lib/auth/require-user";

export default async function NetWorthPage() {
  const { supabase } = await requireUser();
  const summaries = await getNetWorthDashboard(supabase);

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-semibold text-finance-text">ทรัพย์สินสุทธิ</h1>
        <FinanceEmptyState
          icon="finance"
          title="ยังไม่มีข้อมูล"
          description="เพิ่มยอดเงิน บัตรเครดิต หรือรายการยืม/ให้ยืม เพื่อดูภาพรวมทรัพย์สินสุทธิ"
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-semibold text-finance-text">ทรัพย์สินสุทธิ</h1>
      {summaries.map((summary) => (
        <NetWorthCurrencyCard key={summary.currency} summary={summary} />
      ))}
    </div>
  );
}
