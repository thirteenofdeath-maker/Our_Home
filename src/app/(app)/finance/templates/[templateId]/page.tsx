import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/ui/ActionButton";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { restoreTemplateAction } from "@/features/templates/actions";
import { getTemplate } from "@/features/templates/api";
import { ArchiveTemplateForm } from "@/features/templates/components/ArchiveTemplateForm";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

const TYPE_LABEL: Record<"INCOME" | "EXPENSE", string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
};

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { supabase } = await requireUser();

  const template = await getTemplate(supabase, templateId);
  if (!template) notFound();

  const useHref = template.walletId && !template.walletArchived ? `/wallets/${template.walletId}/transactions/new?type=${template.transactionType}&templateId=${templateId}` : `/finance/templates/${templateId}/use`;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">{TYPE_LABEL[template.transactionType]}</p>
        <h1 className="text-xl font-semibold">{template.name}</h1>
      </header>

      {template.archivedAt ? (
        <Card className="border-danger bg-danger/10">
          <p className="font-medium text-danger">Template นี้ถูกเก็บถาวร</p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        {template.amount ? <Row label="จำนวน" value={formatCurrency(template.amount, "THB")} /> : <Row label="จำนวน" value="ไม่กำหนด" />}
        <Row
          label="Wallet"
          value={template.walletName ?? "ไม่กำหนด"}
          valueClassName={template.walletArchived ? "text-danger" : undefined}
          note={template.walletArchived ? "ถูกเก็บถาวร" : undefined}
        />
        <Row
          label="Pocket"
          value={template.pocketName ?? "ไม่กำหนด"}
          valueClassName={template.pocketArchived ? "text-danger" : undefined}
          note={template.pocketArchived ? "ถูกเก็บถาวร" : undefined}
        />
        <Row
          label="หมวดหมู่"
          value={template.categoryName ?? "ไม่กำหนด"}
          valueClassName={template.categoryArchived ? "text-danger" : undefined}
          note={template.categoryArchived ? "ถูกเก็บถาวร" : undefined}
        />
        <Row label="ชื่อรายการ" value={template.title || "-"} />
        <Row label="โน้ต" value={template.note || "-"} />
      </Card>

      {template.tags.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-foreground-muted">แท็ก</p>
          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span
                key={tag.id}
                className={`rounded-full px-3 py-1 text-sm ${tag.archivedAt ? "bg-surface-muted text-foreground-muted line-through" : "bg-surface-muted"}`}
              >
                #{tag.name}
              </span>
            ))}
          </div>
          {template.tags.some((t) => t.archivedAt) ? (
            <p className="text-xs text-foreground-muted">แท็กที่ถูกเก็บถาวรจะไม่ถูกใส่ในรายการใหม่โดยอัตโนมัติ</p>
          ) : null}
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        {!template.archivedAt ? (
          <>
            <Link href={useHref} className={buttonClassName("primary", "lg")}>
              ใช้ Template
            </Link>
            <Link href={`/finance/templates/${templateId}/edit`} className={buttonClassName("secondary", "lg")}>
              แก้ไข
            </Link>
            <ArchiveTemplateForm templateId={templateId} />
          </>
        ) : (
          <ActionButton
            action={restoreTemplateAction}
            hiddenFields={{ id: templateId }}
            label="กู้คืน Template"
            variant="primary"
            className="w-full"
          />
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
