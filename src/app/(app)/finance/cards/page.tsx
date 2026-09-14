import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { loadCreditCards } from "@/features/credit-cards/api";
import { CreditCardSummaryCard } from "@/features/credit-cards/components/CreditCardSummaryCard";
import { requireUser } from "@/lib/auth/require-user";

export default async function CreditCardsPage() {
  const { supabase } = await requireUser();
  const result = await loadCreditCards(supabase, true);
  if (result.status === "error")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="บัตรเครดิต" backHref="/finance" />
        <ErrorState
          title="โหลดข้อมูลบัตรไม่สำเร็จ"
          description="ลองใหม่อีกครั้ง"
          action={
            <Link
              href="/finance/cards"
              className={buttonClassName("secondary", "md", "w-auto")}
            >
              ลองใหม่
            </Link>
          }
        />
      </div>
    );
  const active = result.items.filter((card) => !card.isArchived);
  const archived = result.items.filter((card) => card.isArchived);
  const personal = active.filter((card) => card.scope === "PERSONAL");
  const household = active.filter((card) => card.scope === "HOUSEHOLD");
  return (
    <div className="finance-scope -mx-4 flex flex-col gap-5 px-4 pb-8 pt-2">
      <PageHeader
        title="บัตรเครดิต"
        backHref="/finance"
        rightAction={
          <Link
            href="/finance/cards/new"
            aria-label="เพิ่มบัตรเครดิต"
            className="flex size-11 items-center justify-center rounded-full text-finance-primary-strong"
          >
            <AppIcon name="plus" />
          </Link>
        }
      />
      {active.length ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-finance-muted">ส่วนตัว</h2>
            {personal.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {personal.map((card) => (
                  <CreditCardSummaryCard key={card.accountId} card={card} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-finance-muted">ยังไม่มีบัตรส่วนตัว</p>
            )}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-finance-muted">ครอบครัว</h2>
            {household.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {household.map((card) => (
                  <CreditCardSummaryCard key={card.accountId} card={card} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-finance-muted">ยังไม่มีบัตรครอบครัว</p>
            )}
          </section>
        </>
      ) : (
        <EmptyState
          title="ยังไม่มีบัตรเครดิต"
          description="เพิ่มบัตรเพื่อดูวงเงินและยอดค้างในที่เดียว"
          action={
            <Link
              href="/finance/cards/new"
              className={buttonClassName("primary", "md", "w-auto")}
            >
              เพิ่มบัตรเครดิต
            </Link>
          }
        />
      )}
      {archived.length ? (
        <details className="rounded-card bg-finance-surface-strong p-4">
          <summary className="text-sm text-finance-muted">
            บัตรที่เก็บถาวร ({archived.length})
          </summary>
          <div className="mt-3 grid gap-3">
            {archived.map((card) => (
              <CreditCardSummaryCard key={card.accountId} card={card} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
