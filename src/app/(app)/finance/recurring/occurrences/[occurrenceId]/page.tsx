import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getOccurrence } from "@/features/recurring/api";
import { SkipOccurrenceForm } from "@/features/recurring/components/SkipOccurrenceForm";
import { formatFinanceDate } from "@/features/recurring/types";
import { requireUser } from "@/lib/auth/require-user";

const TYPE_LABEL: Record<"INCOME" | "EXPENSE", string> = { INCOME: "รายรับ", EXPENSE: "รายจ่าย" };
const STATUS_LABEL: Record<"UPCOMING" | "POSTED" | "SKIPPED", string> = { UPCOMING: "กำลังจะถึง", POSTED: "บันทึกแล้ว", SKIPPED: "ข้ามแล้ว" };

export default async function OccurrenceDetailPage({
  params,
}: {
  params: Promise<{ occurrenceId: string }>;
}) {
  const { occurrenceId } = await params;
  const { supabase } = await requireUser();

  const occurrence = await getOccurrence(supabase, occurrenceId);
  if (!occurrence) notFound();

  const useHref =
    occurrence.walletId && !occurrence.walletArchived
      ? `/wallets/${occurrence.walletId}/transactions/new?type=${occurrence.transactionType}&occurrenceId=${occurrenceId}`
      : `/finance/recurring/occurrences/${occurrenceId}/use`;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">{TYPE_LABEL[occurrence.transactionType]}</p>
        <h1 className="text-xl font-semibold">{occurrence.name}</h1>
      </header>

      {occurrence.status !== "UPCOMING" ? (
        <Card className="border-border bg-surface-muted">
          <p className="font-medium">
            {STATUS_LABEL[occurrence.status]}
            {occurrence.status === "POSTED" && occurrence.postedTransactionVoided ? " — รายการที่บันทึกไว้ถูกยกเลิกแล้ว" : ""}
          </p>
          {occurrence.status === "POSTED" && occurrence.postedTransactionId ? (
            <Link href={`/finance/transactions/${occurrence.postedTransactionId}`} className="mt-1 inline-flex text-sm text-primary">
              ดูรายการที่บันทึก
            </Link>
          ) : null}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <Row label="กำหนดวันที่" value={formatFinanceDate(occurrence.dueDate)} />
        <Row label="จำนวนเงิน" value={occurrence.amount} />
        <Row
          label="Wallet"
          value={occurrence.walletName ?? "ไม่กำหนด — เลือกตอนบันทึกรายการ"}
          valueClassName={occurrence.walletArchived ? "text-danger" : undefined}
          note={occurrence.walletArchived ? "ถูกเก็บถาวร" : undefined}
        />
        <Row label="ชื่อรายการ" value={occurrence.title || "-"} />
        <Row label="โน้ต" value={occurrence.note || "-"} />
      </Card>

      {occurrence.status === "UPCOMING" ? (
        <section className="flex flex-col gap-3">
          <Link href={useHref} className={buttonClassName("primary", "lg")}>
            บันทึกรายการ
          </Link>
          <SkipOccurrenceForm occurrenceId={occurrenceId} recurringId={occurrence.recurringId} />
        </section>
      ) : null}

      <Link href={`/finance/recurring/${occurrence.recurringId}`} className="text-center text-sm text-primary">
        ดูรายการประจำ
      </Link>
    </div>
  );
}

function Row({ label, value, valueClassName, note }: { label: string; value: string; valueClassName?: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground-muted">{label}</span>
      <span className="text-right">
        <span className={`text-sm font-medium tabular-nums ${valueClassName ?? ""}`}>{value}</span>
        {note ? <span className="ml-1 text-xs text-danger">({note})</span> : null}
      </span>
    </div>
  );
}
