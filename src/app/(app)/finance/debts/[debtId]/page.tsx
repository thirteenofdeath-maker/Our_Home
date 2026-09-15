import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
import { getDebt } from "@/features/debts/api";
import { DebtArchiveForm } from "@/features/debts/components/DebtArchiveForm";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

export default async function DebtPage({
  params,
}: {
  params: Promise<{ debtId: string }>;
}) {
  const { debtId } = await params;
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const debt = await getDebt(supabase, debtId, household?.id);
  if (!debt) notFound();

  const archived = Boolean(debt.archivedAt);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{debt.name}</h1>
      <p className="text-2xl">
        {formatCurrency(debt.outstanding, debt.currency)}
      </p>
      <p>
        {debt.debtType === "LIABILITY" ? "ยอดที่เรายังค้าง" : "ยอดที่ยังต้องรับ"}
      </p>

      {archived ? (
        <p className="text-muted">
          เก็บถาวรแล้ว · ดูประวัติได้ แต่บันทึกรายการใหม่ไม่ได้
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href={`/finance/debts/${debtId}/payment`}
            className={buttonClassName("primary", "md")}
          >
            บันทึกการชำระ
          </Link>
          <Link
            href={`/finance/debts/${debtId}/principal`}
            className={buttonClassName("secondary", "md")}
          >
            เพิ่มเงินต้น
          </Link>
        </div>
      )}

      <DebtArchiveForm debtId={debtId} archived={archived} />
    </div>
  );
}
