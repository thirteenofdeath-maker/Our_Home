import { formatCurrency } from "@/lib/utils/money";

/**
 * Phase V (0052): the pre-save summary required on every transfer form
 * once fee/interest sections exist — makes explicit that the principal
 * is not income/expense while fee/interest ARE, before the user submits.
 */
export function TransferChargeSummary({
  amount,
  feeAmount,
  interestAmount,
  currency,
}: {
  amount: string;
  feeAmount: string;
  interestAmount: string;
  currency: string;
}) {
  const principal = Number(amount) || 0;
  const fee = Number(feeAmount) || 0;
  const interest = Number(interestAmount) || 0;
  const totalFromSource = principal + fee + interest;

  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface-muted p-3 text-sm">
      <SummaryRow label="จำนวนโอน (เงินต้น)" value={formatCurrency(principal.toFixed(2), currency)} />
      {fee > 0 ? <SummaryRow label="ค่าธรรมเนียม (รายจ่าย)" value={formatCurrency(fee.toFixed(2), currency)} /> : null}
      {interest > 0 ? <SummaryRow label="ดอกเบี้ย (รายจ่าย)" value={formatCurrency(interest.toFixed(2), currency)} /> : null}
      <div className="mt-1 flex flex-col gap-1 border-t border-border pt-1">
        <SummaryRow label="หักจากต้นทางทั้งหมด" value={formatCurrency(totalFromSource.toFixed(2), currency)} emphasize />
        <SummaryRow label="ปลายทางได้รับ" value={formatCurrency(principal.toFixed(2), currency)} emphasize />
      </div>
      <p className="mt-1 text-xs text-foreground-muted">เงินต้นไม่ใช่รายรับหรือรายจ่าย ค่าธรรมเนียมและดอกเบี้ยนับเป็นรายจ่ายเสมอ</p>
    </div>
  );
}

function SummaryRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground-muted">{label}</span>
      <span className={emphasize ? "font-semibold tabular-nums text-foreground" : "tabular-nums text-foreground"}>{value}</span>
    </div>
  );
}
