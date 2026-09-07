import Link from "next/link";
import type { ReactNode } from "react";

import { listCategories } from "@/features/categories/api";
import { AddCategoryForm } from "@/features/categories/components/AddCategoryForm";
import { CategoryManagerList } from "@/features/categories/components/CategoryManagerList";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { type, scope } = await searchParams;
  const transactionType = type === "INCOME" ? "INCOME" : "EXPENSE";
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const activeScope = scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";

  const categories = await listCategories(supabase, {
    transactionType,
    scope: activeScope,
    includeArchived: true,
  });
  const tree = buildCategoryTree(categories);
  const topLevelActive = tree.filter((c) => !c.archived_at);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">หมวดหมู่</h1>

      <div className="flex gap-2">
        <TabLink href={`/categories?type=EXPENSE&scope=${activeScope}`} active={transactionType === "EXPENSE"}>
          รายจ่าย
        </TabLink>
        <TabLink href={`/categories?type=INCOME&scope=${activeScope}`} active={transactionType === "INCOME"}>
          รายรับ
        </TabLink>
        {household ? (
          <>
            <span className="mx-1 self-center text-foreground-muted">|</span>
            <TabLink href={`/categories?type=${transactionType}&scope=PERSONAL`} active={activeScope === "PERSONAL"}>
              ส่วนตัว
            </TabLink>
            <TabLink href={`/categories?type=${transactionType}&scope=HOUSEHOLD`} active={activeScope === "HOUSEHOLD"}>
              ครอบครัว
            </TabLink>
          </>
        ) : null}
      </div>

      <CategoryManagerList tree={tree} />

      <AddCategoryForm transactionType={transactionType} scope={activeScope} topLevelCategories={topLevelActive} />
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-control px-3 py-1.5 text-sm font-medium",
        active ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground-muted",
      )}
    >
      {children}
    </Link>
  );
}
