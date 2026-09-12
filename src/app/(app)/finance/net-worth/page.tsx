import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { getNetWorth } from "@/features/net-worth/api";
import { requireUser } from "@/lib/auth/require-user";
import { addMoney, formatCurrency } from "@/lib/utils/money";

export default async function NetWorthPage() {
  const { supabase } = await requireUser();
  const rows = await getNetWorth(supabase);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-semibold text-finance-text">ทรัพย์สินสุทธิ</h1>
        <FinanceEmptyState icon="finance" title="ยังไม่มีข้อมูล" description="เพิ่มกระเป๋าเงินหรือรายการยืม/ให้ยืมเพื่อดูภาพรวมทรัพย์สินสุทธิ" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-finance-text">ทรัพย์สินสุทธิ</h1>
      {rows.map((row) => {
        // "Assets" composition = Wallet balances + receivables (money
        // owed TO the user) — both already-authoritative decimal
        // strings from get_net_worth; summed here only to size the
        // proportional bar below (a ratio, via Number()), never to
        // replace either figure's own display, which always comes
        // straight from the RPC via formatCurrency.
        const assetsTotal = addMoney(row.walletAssets, row.receivables);
        const assetsRatio = Number(assetsTotal) > 0 ? Number(assetsTotal) / (Number(assetsTotal) + Number(row.liabilities)) : 0;

        return (
          <div key={row.currency} className="flex flex-col gap-3">
            <div className="rounded-[1.5rem] bg-finance-primary p-5 text-white shadow-[0_1px_2px_rgb(68_80_92_/_0.04),0_8px_20px_rgb(68_80_92_/_0.12)]">
              <p className="text-sm text-white/75">ทรัพย์สินสุทธิ · {row.currency}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{formatCurrency(row.netWorth, row.currency)}</p>
            </div>

            {Number(assetsTotal) > 0 || Number(row.liabilities) > 0 ? (
              <div className="h-2 w-full overflow-hidden rounded-full bg-finance-expense/30">
                <div className="h-full bg-finance-income" style={{ width: `${Math.max(0, Math.min(100, assetsRatio * 100))}%` }} />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2 rounded-[1.25rem] bg-finance-surface-strong p-4">
                <p className="text-xs font-medium text-finance-income">ทรัพย์สิน</p>
                <p className="text-lg font-semibold tabular-nums text-finance-text">{formatCurrency(assetsTotal, row.currency)}</p>
                <div className="flex flex-col gap-1 text-xs text-finance-muted">
                  <div className="flex justify-between">
                    <span>กระเป๋าเงิน</span>
                    <span className="tabular-nums">{formatCurrency(row.walletAssets, row.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>เงินให้ยืม</span>
                    <span className="tabular-nums">{formatCurrency(row.receivables, row.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-[1.25rem] bg-finance-surface-strong p-4">
                <p className="text-xs font-medium text-finance-expense">หนี้สิน</p>
                <p className="text-lg font-semibold tabular-nums text-finance-text">{formatCurrency(row.liabilities, row.currency)}</p>
                <div className="flex flex-col gap-1 text-xs text-finance-muted">
                  <div className="flex justify-between">
                    <span>ยืมมา</span>
                    <span className="tabular-nums">{formatCurrency(row.liabilities, row.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
