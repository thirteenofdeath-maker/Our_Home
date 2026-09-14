import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClassName } from "@/components/ui/Button";
import { getDebt } from "@/features/debts/api";
import { setDebtArchivedAction } from "@/features/debts/actions";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";
export default async function Page({params}:{params:Promise<{debtId:string}>}){const{debtId}=await params;const{supabase,user}=await requireUser();const h=await getMyPrimaryHousehold(supabase,user.id);const d=await getDebt(supabase,debtId,h?.id);if(!d)notFound();return <div className="flex flex-col gap-4"><h1 className="text-xl font-semibold">{d.name}</h1><p className="text-2xl">{formatCurrency(d.outstanding,d.currency)}</p><p>{d.debtType==="LIABILITY"?"ยอดที่เรายังค้าง":"ยอดที่ยังต้องรับ"}</p>{d.archivedAt?<p className="text-muted">เก็บถาวรแล้ว · ดูประวัติได้ แต่บันทึกรายการใหม่ไม่ได้</p>:<div className="flex flex-col gap-2"><Link href={`/finance/debts/${debtId}/payment`} className={buttonClassName("primary","md")}>บันทึกการชำระ</Link><Link href={`/finance/debts/${debtId}/principal`} className={buttonClassName("secondary","md")}>เพิ่มเงินต้น</Link></div>}<form action={setDebtArchivedAction}><input type="hidden" name="debtId" value={debtId}/><input type="hidden" name="archived" value={d.archivedAt?"false":"true"}/><button className="min-h-11 text-primary" type="submit">{d.archivedAt?"นำกลับมาใช้":"เก็บถาวร"}</button></form></div>}
