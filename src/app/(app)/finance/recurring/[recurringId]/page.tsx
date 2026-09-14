import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getRecurringTransaction, listOccurrencesForRule, materializeRecurringOccurrences } from "@/features/recurring/api";
import { OccurrenceCard } from "@/features/recurring/components/OccurrenceCard";
import { RecurringLifecycleActions } from "@/features/recurring/components/RecurringLifecycleActions";
import { formatFinanceDate, frequencyLabel } from "@/features/recurring/types";
import { requireUser } from "@/lib/auth/require-user";

const TYPE_LABEL: Record<"INCOME" | "EXPENSE", string> = { INCOME: "รายรับ", EXPENSE: "รายจ่าย" };

export default async function RecurringDetailPage({
  params,
}: {
  params: Promise<{ recurringId: string }>;
}) {
  const { recurringId } = await params;
  const { supabase } = await requireUser();

  const rule = await getRecurringTransaction(supabase, recurringId);
  if (!rule) notFound();

  // Materializing here too (not just the list page) means opening a
  // rule directly always shows an up-to-date occurrence history.
  await materializeRecurringOccurrences(supabase, { scope: rule.scope, householdId: rule.householdId });
  const occurrences = await listOccurrencesForRule(supabase, recurringId);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">{TYPE_LABEL[rule.transactionType]}</p>
        <h1 className="text-xl font-semibold">{rule.name}</h1>
      </header>

      {rule.archivedAt ? (
        <Card className="border-danger bg-danger/10">
          <p className="font-medium text-danger">รายการประจำนี้ถูกเก็บถาวร</p>
        </Card>
      ) : rule.pausedAt ? (
        <Card className="border-border bg-surface-muted">
          <p className="font-medium">หยุดชั่วคราว — ไม่มีการสร้างรายการที่กำลังจะถึงใหม่</p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <Row label="จำนวนเงิน" value={rule.amount} />
        <Row label="ความถี่" value={frequencyLabel(rule.frequency, rule.intervalCount)} />
        <Row label="เริ่มวันที่" value={formatFinanceDate(rule.startDate)} />
        <Row label="สิ้นสุด" value={rule.endDate ? formatFinanceDate(rule.endDate) : "ไม่มี"} />
        <Row
          label="Wallet"
          value={rule.walletName ?? "ไม่กำหนด — เลือกตอนบันทึกรายการ"}
          valueClassName={rule.walletArchived ? "text-danger" : undefined}
          note={rule.walletArchived ? "ถูกเก็บถาวร" : undefined}
        />
        <Row
          label="Pocket"
          value={rule.pocketName ?? "ไม่กำหนด"}
          valueClassName={rule.pocketArchived ? "text-danger" : undefined}
          note={rule.pocketArchived ? "ถูกเก็บถาวร" : undefined}
        />
        <Row
          label="หมวดหมู่"
          value={rule.categoryName ?? "ไม่กำหนด"}
          valueClassName={rule.categoryArchived ? "text-danger" : undefined}
          note={rule.categoryArchived ? "ถูกเก็บถาวร" : undefined}
        />
        <Row label="ชื่อรายการ" value={rule.title || "-"} />
        <Row label="โน้ต" value={rule.note || "-"} />
      </Card>

      {rule.tags.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-foreground-muted">แท็ก</p>
          <div className="flex flex-wrap gap-2">
            {rule.tags.map((tag) => (
              <span key={tag.id} className={`rounded-full px-3 py-1 text-sm ${tag.archivedAt ? "bg-surface-muted text-foreground-muted line-through" : "bg-surface-muted"}`}>
                #{tag.name}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <Link href={`/finance/recurring/${recurringId}/edit`} className={buttonClassName("secondary", "lg")}>
          แก้ไข
        </Link>
        <RecurringLifecycleActions rule={rule} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">รายการที่เกิดขึ้น</h2>
        {occurrences.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground-muted">ยังไม่มีรายการ</p>
        ) : (
          <div className="flex flex-col gap-2">
            {occurrences.map((item) => (
              <OccurrenceCard key={item.occurrenceId} item={item} compact />
            ))}
          </div>
        )}
      </section>
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
