import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  archiveCreditCardAction,
  restoreCreditCardAction,
} from "@/features/credit-cards/actions";
import { getCreditCard, listCreditCardActivity } from "@/features/credit-cards/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-finance-muted">{label}</span>
      <span className="text-right font-medium text-finance-text">{value}</span>
    </div>
  );
}

export default async function CreditCardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const { supabase } = await requireUser();
  const card = await getCreditCard(supabase, cardId);
  if (!card) notFound();
  const activity = await listCreditCardActivity(supabase, cardId);
  return (
    <div className="finance-scope -mx-4 flex flex-col gap-4 px-4 pb-8 pt-2">
      <PageHeader
        title={card.name}
        backHref="/finance/cards"
        rightAction={
          <Link
            href={`/finance/cards/${cardId}/edit`}
            aria-label="แก้ไขข้อมูลบัตร"
            className="flex size-11 items-center justify-center"
          >
            <AppIcon name="more" />
          </Link>
        }
      />
      <Card className="bg-finance-primary p-5 text-white">
        <p className="text-sm text-white/75">ยอดค้างชำระ</p>
        <p className="mt-1 text-3xl font-semibold">
          {formatCurrency(card.liability, card.currency)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-white/70">วงเงิน</p>
            <p>{formatCurrency(card.creditLimit, card.currency)}</p>
          </div>
          <div>
            <p className="text-white/70">วงเงินใช้ได้</p>
            <p>{formatCurrency(card.availableCredit, card.currency)}</p>
          </div>
        </div>
        {Number(card.cardCredit) > 0 ? (
          <p className="mt-3 text-sm">
            ยอดเครดิต {formatCurrency(card.cardCredit, card.currency)}
          </p>
        ) : null}
      </Card>
      <Card className="flex flex-col gap-3">
        <Row
          label="ประเภท"
          value={card.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
        />
        <Row
          label="ข้อมูลบัตร"
          value={
            [
              card.issuer,
              card.network,
              card.lastFour ? `•••• ${card.lastFour}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"
          }
        />
        <Row label="วันตัดรอบ" value={`วันที่ ${card.statementClosingDay}`} />
        <Row label="วันครบกำหนด" value={`วันที่ ${card.paymentDueDay}`} />
        <Row
          label="APR"
          value={card.apr == null ? "ไม่ระบุ" : `${card.apr}% (ข้อมูลเท่านั้น)`}
        />
      </Card>
      <Card className="grid grid-cols-2 gap-2">
        <Link href={`/finance/cards/${cardId}/purchase`} className={buttonClassName("financeExpense", "md")}>
          ซื้อผ่านบัตร
        </Link>
        <Button disabled variant="financeTransfer">
          จ่ายบัตร (เร็ว ๆ นี้)
        </Button>
        <Button disabled variant="secondary">
          Cashback
        </Button>
        <Button disabled variant="secondary">
          กดเงินสด
        </Button>
        <Button disabled variant="secondary" className="col-span-2">
          ปรับยอด
        </Button>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold text-finance-text">รายการบัตรล่าสุด</h2>
        {activity.length ? activity.map((item) => (
          <Link
            key={item.eventId}
            href={`/finance/transactions/${item.transactionId}`}
            className={`flex items-center justify-between gap-3 border-b border-border py-2 last:border-0 ${item.isVoided ? "opacity-50" : ""}`}
          >
            <div>
              <p className="text-sm font-medium">{item.title || item.categoryName || (item.eventKind === "PURCHASE_REFUND" ? "คืนเงิน" : "ซื้อผ่านบัตร")}</p>
              <p className="text-xs text-finance-muted">{new Date(item.occurredAt).toLocaleDateString("th-TH")}{item.isVoided ? " · ยกเลิกแล้ว" : ""}</p>
            </div>
            <span className={item.eventKind === "PURCHASE_REFUND" ? "text-income" : "text-expense"}>
              {item.eventKind === "PURCHASE_REFUND" ? "−" : "+"}{formatCurrency(Math.abs(Number(item.amount)).toFixed(2), card.currency)}
            </span>
          </Link>
        )) : <p className="text-sm text-finance-muted">ยังไม่มีรายการผ่านบัตร</p>}
      </Card>
      {card.isArchived ? (
        <form action={restoreCreditCardAction}>
          <input type="hidden" name="accountId" value={card.accountId} />
          <button className={buttonClassName("secondary", "md")}>
            กู้คืนบัตร
          </button>
        </form>
      ) : (
        <ActionButton
          action={archiveCreditCardAction}
          hiddenFields={{ accountId: card.accountId }}
          label="เก็บบัตรถาวร"
          variant="danger"
          className="w-full"
        />
      )}
    </div>
  );
}
