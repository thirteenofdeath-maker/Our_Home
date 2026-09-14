import Link from "next/link";
import {formatCurrency} from "@/lib/utils/money";
import type {CreditCardStatement} from "../types";
const labels={OPEN:"รอชำระ",PARTIALLY_PAID:"ชำระบางส่วน",PAID:"ชำระแล้ว",OVERDUE:"เกินกำหนด"} as const;
export function CreditCardStatementCard({cardId,currency,statement}:{cardId:string;currency:string;statement:CreditCardStatement}){
 return <Link href={`/finance/cards/${cardId}/statements/${statement.statementId}`} className="flex flex-col gap-2 rounded-card bg-finance-surface-strong p-4 shadow-card">
  <div className="flex items-center justify-between gap-3"><span className="font-medium text-finance-text">รอบถึง {new Date(`${statement.periodEnd}T12:00:00`).toLocaleDateString("th-TH")}</span><span className={statement.status==="OVERDUE"?"text-sm font-medium text-danger":"text-sm font-medium text-finance-primary-strong"}>{labels[statement.status]}</span></div>
  <div className="flex items-baseline justify-between"><span className="text-xs text-finance-muted">ยอดที่ต้องจัดการ</span><span className="font-semibold tabular-nums text-finance-text">{formatCurrency(statement.effectiveAmountDue,currency)}</span></div>
  <p className="text-xs text-finance-muted">ครบกำหนด {new Date(`${statement.dueDate}T12:00:00`).toLocaleDateString("th-TH")}</p>
 </Link>;
}
