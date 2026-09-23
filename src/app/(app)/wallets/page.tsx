import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { FinanceHeader } from "@/features/finance/components/FinanceHeader";
import { FinanceModuleTabs } from "@/features/finance/components/FinanceModuleTabs";
import { listPocketsWithBalances } from "@/features/pockets/api";
import { listArchivedWallets, listMyWallets } from "@/features/wallets/api";
import { WalletForm } from "@/features/wallets/components/WalletForm";
import { WalletVisualCard } from "@/features/wallets/components/WalletVisualCard";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, sumMoney } from "@/lib/utils/money";

export default async function WalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { scope: rawScope } = await searchParams;
  const [wallets, archivedWallets, household] = await Promise.all([
    listMyWallets(supabase),
    listArchivedWallets(supabase),
    getMyPrimaryHousehold(supabase, user.id),
  ]);
  const withBalance = await Promise.all(
    wallets.map(async (wallet) => ({
      wallet,
      pockets: await listPocketsWithBalances(supabase, wallet.id),
    })),
  );
  const scope =
    rawScope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";
  const visible = withBalance.filter((item) => item.wallet.scope === scope);
  const currencies = [
    ...new Set(
      visible.flatMap((item) => item.pockets.map((pocket) => pocket.currency)),
    ),
  ];
  const totals = currencies.map((currency) => ({
    currency,
    amount: sumMoney(
      visible.flatMap((item) =>
        item.pockets
          .filter((pocket) => pocket.currency === currency)
          .map((pocket) => pocket.balance),
      ),
    ),
  }));

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-h-full flex-col gap-4 px-4 pb-8 pt-2">
      <FinanceHeader />
      <FinanceModuleTabs />
      <PageHeader title="กระเป๋าเงิน" />
      <FormSheetButton
        ariaLabel="เพิ่มกระเป๋าเงิน"
        triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
        sheetTitle="สร้างกระเป๋าเงิน"
        form={
          <WalletForm
            defaultScope={scope}
            hasHousehold={Boolean(household)}
            variant="sheet"
          />
        }
        tone="finance"
      >
        <AppIcon name="plus" />
      </FormSheetButton>
      <section className="relative overflow-hidden rounded-[1.65rem] time-tinted-panel p-5 shadow-card">
        <div className="absolute -right-5 -top-8 size-28 rounded-full bg-white/45" />
        <p className="relative text-sm font-medium text-finance-muted">
          ยอดรวม{scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
        </p>
        <div className="relative mt-1 flex flex-col gap-1">
          {totals.length ? (
            totals.map((total) => (
              <p
                key={total.currency}
                className="text-3xl font-bold tabular-nums tracking-tight text-finance-text"
              >
                {formatCurrency(total.amount, total.currency)}
              </p>
            ))
          ) : (
            <p className="text-3xl font-bold text-finance-text">฿0.00</p>
          )}
        </div>
        <p className="relative mt-3 text-xs text-finance-muted">
          {visible.length} กระเป๋าที่ใช้งานอยู่
        </p>
      </section>

      {household ? (
        <div className="grid grid-cols-2 rounded-[1.15rem] bg-finance-surface-strong p-1 shadow-sm">
          <ScopeTab
            href="/wallets?scope=PERSONAL"
            active={scope === "PERSONAL"}
          >
            ส่วนตัว
          </ScopeTab>
          <ScopeTab
            href="/wallets?scope=HOUSEHOLD"
            active={scope === "HOUSEHOLD"}
          >
            ครอบครัว
          </ScopeTab>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-finance-text">
            {scope === "PERSONAL" ? "กระเป๋าของฉัน" : "กระเป๋าครอบครัว"}
          </h2>
          <span className="text-sm text-finance-muted">
            {visible.length} รายการ
          </span>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title="ยังไม่มีกระเป๋าเงิน"
            description={
              scope === "PERSONAL"
                ? "เพิ่มบัญชีธนาคาร เงินสด หรือบัตรเครดิต"
                : "เพิ่มกระเป๋าที่ใช้ร่วมกันในบ้าน"
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map(({ wallet, pockets }, index) => (
              <WalletVisualCard
                key={wallet.id}
                id={wallet.id}
                name={wallet.name}
                scopeLabel={scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
                balances={[
                  ...new Set(pockets.map((pocket) => pocket.currency)),
                ].map((currency) => ({
                  currency,
                  amount: sumMoney(
                    pockets
                      .filter((pocket) => pocket.currency === currency)
                      .map((pocket) => pocket.balance),
                  ),
                }))}
                index={index}
              />
            ))}
          </div>
        )}
      </section>

      {archivedWallets.length ? (
        <details className="rounded-[1.25rem] bg-finance-surface-strong px-4 py-3 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-finance-muted">
            กระเป๋าที่เก็บถาวร ({archivedWallets.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {archivedWallets.map((wallet) => (
              <li key={wallet.id}>
                <Link
                  href={`/wallets/${wallet.id}`}
                  className="flex min-h-11 items-center justify-between rounded-[1rem] bg-finance-primary-soft px-3 py-2"
                >
                  <span className="text-finance-muted line-through">
                    {wallet.name}
                  </span>
                  <span className="text-xs text-finance-muted">เก็บถาวร</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ScopeTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-11 items-center justify-center rounded-[0.9rem] text-sm font-semibold",
        active
          ? "bg-finance-primary-soft text-finance-primary-strong"
          : "text-finance-muted",
      )}
    >
      {children}
    </Link>
  );
}
