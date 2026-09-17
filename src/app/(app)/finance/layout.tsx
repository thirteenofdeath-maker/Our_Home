"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { FinanceHeader } from "@/features/finance/components/FinanceHeader";
import { FinanceModuleTabs } from "@/features/finance/components/FinanceModuleTabs";

const SECTION_TITLES: Record<string, string> = {
  "quick-add": "เพิ่มรายการ",
  transactions: "รายการทั้งหมด",
  tags: "แท็ก",
  budgets: "งบประมาณ",
  templates: "Template รายการ",
  recurring: "รายการประจำ",
  bills: "บิลและกำหนดจ่าย",
  installments: "แผนผ่อนชำระ",
  goals: "เป้าหมายการออม",
  debts: "หนี้และเงินยืม",
  reports: "รายงานการเงิน",
  "net-worth": "ทรัพย์สินสุทธิ",
  insights: "ข้อมูลเชิงลึก",
  import: "นำเข้า CSV",
  export: "ส่งออก CSV",
};

/**
 * Semantic Back target for every /finance/** subpage — derived from this
 * module's actual two route shapes (audited directly against
 * src/app/(app)/finance/**), never a blind "drop the last URL segment":
 *
 *   /finance/<section>                          -> /finance (the Hub)
 *   /finance/<section>/new                      -> /finance/<section>
 *   /finance/<section>/[id]                     -> /finance/<section>
 *   /finance/<section>/[id]/edit|payment|...    -> /finance/<section>/[id]
 *   /finance/<section>/occurrences/[id]         -> /finance/<section>
 *   /finance/<section>/occurrences/[id]/pay|use -> .../occurrences/[id]
 *
 * Installments is the one real exception: it has no standalone occurrence
 * detail page (only the pay form itself), so its occurrence route always
 * collapses straight to the section root rather than an intermediate
 * detail page that doesn't exist.
 */
export function financeBackHref(pathname: string): string | undefined {
  if (pathname === "/finance") return undefined;
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[1] ?? "";
  if (segments.length <= 2) return "/finance";
  if (section === "installments" && segments[2] === "occurrences")
    return "/finance/installments";
  if (segments[2] === "occurrences") {
    return segments.length === 4
      ? `/finance/${section}`
      : `/finance/${section}/occurrences/${segments[3]}`;
  }
  return segments.length === 3
    ? `/finance/${section}`
    : `/finance/${section}/${segments[2]}`;
}

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = pathname.split("/")[2] ?? "";

  const isModuleRoot = pathname.split("/").filter(Boolean).length <= 2;

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 min-h-full flex-col gap-4 px-4 pb-8 pt-3">
      {isModuleRoot ? (
        <>
          <FinanceHeader />
          <FinanceModuleTabs />
        </>
      ) : null}
      {pathname !== "/finance" && pathname !== "/finance/transactions" ? (
        <PageHeader
          title={SECTION_TITLES[section] ?? "การเงิน"}
          backHref={financeBackHref(pathname)}
        />
      ) : null}
      {children}
    </div>
  );
}
