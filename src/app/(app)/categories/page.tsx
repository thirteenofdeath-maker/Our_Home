import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FinanceHeader } from "@/features/finance/components/FinanceHeader";
import { FinanceModuleTabs } from "@/features/finance/components/FinanceModuleTabs";
import Link from "next/link";
import type { ReactNode } from "react";

import { listCategories } from "@/features/categories/api";
import { AddCategoryForm } from "@/features/categories/components/AddCategoryForm";
import { CategoryManagerList } from "@/features/categories/components/CategoryManagerList";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { type, scope } = await searchParams;
  const transactionType = type === "INCOME" ? "INCOME" : "EXPENSE";
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const activeScope =
    scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";

  const categories = await listCategories(supabase, {
    transactionType,
    scope: activeScope,
    includeArchived: true,
  });
  const tree = buildCategoryTree(categories);
  const topLevelActive = tree.filter((c) => !c.is_system && !c.archived_at);

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-4 px-4 pb-8 pt-3">
      <FinanceHeader />
      <FinanceModuleTabs />
      <PageHeader title="หมวดหมู่" />

      <div className="flex gap-2">
        <TabLink
          href={`/categories?type=EXPENSE&scope=${activeScope}`}
          active={transactionType === "EXPENSE"}
        >
          รายจ่าย
        </TabLink>
        <TabLink
          href={`/categories?type=INCOME&scope=${activeScope}`}
          active={transactionType === "INCOME"}
        >
          รายรับ
        </TabLink>
        {household ? (
          <>
            <span className="mx-1 self-center text-foreground-muted">|</span>
            <TabLink
              href={`/categories?type=${transactionType}&scope=PERSONAL`}
              active={activeScope === "PERSONAL"}
            >
              ส่วนตัว
            </TabLink>
            <TabLink
              href={`/categories?type=${transactionType}&scope=HOUSEHOLD`}
              active={activeScope === "HOUSEHOLD"}
            >
              ครอบครัว
            </TabLink>
          </>
        ) : null}
      </div>

      <CategoryManagerList tree={tree} />

      <FormSheetButton
        ariaLabel="เพิ่มหมวดหมู่"
        sheetTitle="เพิ่มหมวดหมู่"
        tone="finance"
        triggerClassName="app-fab fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
        form={
          <AddCategoryForm
            transactionType={transactionType}
            scope={activeScope}
            topLevelCategories={topLevelActive}
          />
        }
      >
        <AppIcon name="plus" />
      </FormSheetButton>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-control px-3 py-1.5 text-sm font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface-muted text-foreground-muted",
      )}
    >
      {children}
    </Link>
  );
}
