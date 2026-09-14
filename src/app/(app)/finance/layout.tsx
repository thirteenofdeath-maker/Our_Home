"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { FinanceModuleTabs } from "@/features/finance/components/FinanceModuleTabs";

/**
 * The six Finance V2 Phase 2 module pages (see FinanceModuleTabs) get the
 * horizontal module rail — but only on their own top-level list/overview
 * route, never on a deeper task page (`/finance/budgets/new`,
 * `/finance/budgets/[budgetId]`, a debt's payment form, ...), which stay
 * compact single-purpose subpages exactly as before.
 */
const MODULE_SECTIONS = new Set([
  "transactions",
  "budgets",
  "debts",
  "goals",
  "bills",
]);

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
  "net-worth": "มูลค่าสุทธิ",
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
  if (pathname === "/finance") return children;
  const section = pathname.split("/")[2] ?? "";
  const isModuleRoot =
    MODULE_SECTIONS.has(section) && pathname === `/finance/${section}`;

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-h-full flex-col gap-4 px-4 pt-2">
      <PageHeader
        title={SECTION_TITLES[section] ?? "การเงิน"}
        backHref={financeBackHref(pathname)}
      />
      {isModuleRoot ? (
        // finance-scope wraps the rail + the page's own content together
        // (never PageHeader itself, kept palette-neutral across every
        // finance subpage) — only these six module ROOT routes get it;
        // a deeper task page under the same section (new/edit/detail
        // forms) renders through the plain `else` branch below, unchanged.
        <div className="flex flex-col gap-4 pb-4">
          <FinanceModuleTabs />
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
