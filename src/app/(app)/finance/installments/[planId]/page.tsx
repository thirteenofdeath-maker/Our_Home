import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { getInstallmentPlan, listInstallmentOccurrences } from "@/features/installments/api";
import type { InstallmentOccurrenceSummary } from "@/features/installments/types";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";
import { formatFinanceDate } from "@/features/recurring/types";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { supabase } = await requireUser();
  const p = await getInstallmentPlan(supabase, planId);
  if (!p) notFound();
  const rows = await listInstallmentOccurrences(supabase, planId);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{p.name}</h1>
      <p>
        {formatCurrency(p.totalAmount, p.currency)} · {p.installmentCount} งวด
      </p>
      {rows.map((x) => (
        <OccurrenceRow key={x.id} x={x} currency={p.currency} />
      ))}
    </div>
  );
}

// OPEN = starting a real pay workflow — a direct, ordinary navigation
// link to the existing /pay route, same as PAID's own plain Link to the
// resulting transaction. Neither is a Create/Add action, so neither
// opens a bottom-slide sheet of any kind.
function OccurrenceRow({ x, currency }: { x: InstallmentOccurrenceSummary; currency: string }) {
  const cardContent = (
    <Card className="flex justify-between">
      <span>
        งวด {x.sequenceNumber} · {formatFinanceDate(x.dueDate)}
      </span>
      <span>
        {formatCurrency(x.expectedAmount, currency)} · {x.status}
      </span>
    </Card>
  );

  if (x.status === "OPEN") {
    return <Link href={`/finance/installments/occurrences/${x.id}/pay`}>{cardContent}</Link>;
  }

  return <Link href={`/finance/transactions/${x.paidTransactionId}`}>{cardContent}</Link>;
}
